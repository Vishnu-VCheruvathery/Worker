import { S3Client } from "@aws-sdk/client-s3";
import { encode } from "gpt-tokenizer"
import {Poppler} from "node-poppler"
import { createWorker } from "tesseract.js"
import path from "path";
import fs  from 'fs'

const poppler = new Poppler()

 const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_KEY!,
    },
 });

const pdfToPics = async (filepath: string, name: string) => {
  const options = {
    pngFile: true,
  };

  const imagesDir = path.resolve(process.cwd(), "images");

  // ensure directory exists
  fs.mkdirSync(imagesDir, { recursive: true });

  const outputFile = path.join(imagesDir, name);

  console.log("images folder:", outputFile);

  try {
    await poppler.pdfToCairo(filepath, outputFile, options);
  } catch (error) {
    console.log("Error while creating images:", error);
  }
};

function chunkText(text:string, maxTokens = 500, overlap=50){
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk:string[] = [];
    let tokenCount = 0;

    for(const sentence of sentences){
        const tokens = encode(sentence).length;
        if(tokenCount + tokens > maxTokens){
            chunks.push(currentChunk.join(" "));
            currentChunk = currentChunk.slice(-overlap);
            tokenCount = encode(currentChunk.join(" ")).length;
        }

        currentChunk.push(sentence);
        tokenCount += tokens;
    }

    if(currentChunk.length){
        chunks.push(currentChunk.join(" "));
    }

    return chunks;
}


const extractText = async(imagePath: string) => {
       try {
           const worker = await createWorker('eng');
           const result = await worker.recognize(imagePath);
           const chunks = chunkText(result.data.text, 500, 50)   
           await worker.terminate();
           return chunks
       } catch (error) {
        console.error('Error during OCR processing: ', error);
       }
}

export {extractText, pdfToPics, s3Client}