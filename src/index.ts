import "dotenv/config";
import './workers/uploadWorker'
import mongoose from "mongoose";
import { initChroma } from "./db/chromaCollection";

const start = async() => {
    await initChroma()
    console.log("Chroma started")
}

start()

mongoose.connect(process.env.MONGO_URL!).then(() => console.log("Connected to MongoDB"))
        .catch((err) => console.error("Failed to connect to MongoDB", err));





