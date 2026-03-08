import "dotenv/config";
import { CloudClient } from "chromadb";

const client = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY,
  tenant: process.env.CHROMA_TENANT,
  database: process.env.CHROMA_DB,
});

let ocrCollection: any;

export const initChroma = async () => {
  ocrCollection = await client.getOrCreateCollection({
    name: "ocr_data",
  });

  console.log("Chroma collection ready");
};

export { ocrCollection };