import express from 'express';
import http from 'node:http';
import dotenv from 'dotenv';
import { setupVmRelay } from './relay.mjs';
dotenv.config();
const app = express();
const server = http.createServer(app);
setupVmRelay(app, server);
server.listen(3001, '127.0.0.1', () => console.log('VM relay development API listening on http://127.0.0.1:3001 (no database required).'));
