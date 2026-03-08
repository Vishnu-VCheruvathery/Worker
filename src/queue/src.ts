import 'dotenv/config'
import {connection} from '../config/redis'
import {Queue} from 'bullmq'

// const uploadQueue = new Queue('upload', {connection});
const ocrQueue = new Queue('ocr', {connection});

export { ocrQueue}