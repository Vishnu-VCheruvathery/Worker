import "dotenv/config";
import './workers/uploadWorker'
import mongoose from "mongoose";
import { initChroma } from "./db/chromaCollection";
import http from "http";
const PORT = process.env.PORT ||  10000

const start = async() => {
    await initChroma()
    console.log("Chroma started")
}


http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Worker alive")
}).listen(PORT, () => {
    console.log("Health server listening on", PORT)
})

start()

mongoose.connect(process.env.MONGO_URL!).then(() => console.log("Connected to MongoDB"))
        .catch((err) => console.error("Failed to connect to MongoDB", err));





