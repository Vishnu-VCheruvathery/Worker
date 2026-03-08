import { Worker } from "bullmq";
import { Document } from "../db/document";
import { ocrQueue } from "../queue/src";
import { extractText, pdfToPics, s3Client } from "../utils/helpers";
import {connection} from '../config/redis'
import fs, { createWriteStream } from 'fs'
import { ocrCollection } from "../db/chromaCollection";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import { promisify } from "util";
import { pipeline, Readable } from "stream";



type Metadata = {
    doc_id: string,
    file_name: string,
    page_number: number,
    chunk_index: number,
    timestamp: string,
    source_type: string,
    conversation_id: string
}

interface ResultText{
    text:string,
    metadata: Metadata
}

const streamPipeline = promisify(pipeline)

const uploadWorker = new Worker('upload', async job => {
    const {key,  convId, fileName, fileType} = job.data;

        const currentDir = __dirname;
const oneLevelUp = path.resolve(currentDir, '..', 'uploads', `${fileName}`);
    try {
       const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key
       })

       const response = await s3Client.send(command);

       await streamPipeline(
        response.Body as Readable,
        createWriteStream(oneLevelUp)
       )

      
        await pdfToPics(oneLevelUp , fileName);
        const document = new Document({
            title: fileName,
            type: fileType
        })
        await document.save();

        await ocrQueue.add('ocr', {id: document._id, convId})
    } catch (error) {
        console.log(error);
    }
}, {connection})

uploadWorker.on('completed', job => {
  const {fileName} = job.data
      const currentDir = __dirname;
const oneLevelUp = path.resolve(currentDir, '..', 'uploads', `${fileName}`);
      fs.unlink(oneLevelUp, (err) => {
                        if(err){
                            console.error('Error deleting file: ', err);
                        }else{
                            console.log('Uploaded FILE DELETED')
                        }
                     })
    console.log(`Upload Job with id ${job.id} has been completed`);
})

uploadWorker.on("failed", (job, err) => {
    console.log(`Job with id ${job?.id} has failed with error ${err.message}`);
})

const ocrWorker = new Worker(
  "ocr",
  async (job) => {
    const { id, convId } = job.data;

    try {
      let resultTexts: ResultText[] = [];
       const currentDir = __dirname;
       const imagesFolder = path.resolve(currentDir, '..', 'images')
       console.log('the images folder in OCR: ', imagesFolder)
      const files = fs.readdirSync(imagesFolder)
  .sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] ?? "0");
    const numB = parseInt(b.match(/\d+/)?.[0] ?? "0");
    return numA - numB;
  });

      for (let pageIndex = 0; pageIndex < files.length; pageIndex++) {
        const file = files[pageIndex];
        const imagePath = path.join(imagesFolder, file);

        const chunks = await extractText(imagePath);

        chunks?.forEach((chunk, chunkIndex) => {
          resultTexts.push({
            text: chunk,
            metadata: {
              doc_id: id,
              file_name: file,
              page_number: pageIndex,
              chunk_index: chunkIndex,
              conversation_id: convId,
              timestamp: new Date().toISOString(),
              source_type: "ocr-image",
            },
          });
        });

        const percent = Math.round(((pageIndex + 1) / files.length) * 100);
        await job.updateProgress(percent);
      }

      if (resultTexts.length === 0) {
        console.log("⚠️ No OCR text extracted, skipping insert");
        return;
      }

      console.log("✅ Inserting chunks into Chroma:", resultTexts.length);

      // ✅ MUST await insert
      await ocrCollection.add({
        ids: resultTexts.map((_, i) => `${convId}-${id}-${i}`),
        documents: resultTexts.map((r) => r.text),
        metadatas: resultTexts.map((r) => r.metadata),
      });

      console.log("🎉 Insert complete!");

    } catch (error) {
      console.error("🔥 OCR Worker Error:", error);
      throw error;
    }
  },
  { connection }
);



ocrWorker.on('completed', job => {
  const currentDir = __dirname;
       const imagesFolder = path.resolve(currentDir, '..', 'images')
    const files = fs.readdirSync(imagesFolder);
     files.forEach(async(file) => {
                          const imagePath = path.join(imagesFolder, file);   
                         fs.unlink(imagePath, (err) => {
                        if(err){
                            console.error('Error deleting file: ', err);
                        }else{
                            console.log('IMG FILE DELETED')
                        }
                     })
                     })   
          
        console.log(`OCR Job with id ${job.id} has been completed`);
})

ocrWorker.on("failed", (job, err) => {


console.log(`Job with id ${job?.id} has failed with error ${err.message}`);
})




