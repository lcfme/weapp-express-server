import http from 'http';
import express from 'express';
import WebSocket from 'ws';
import cors from 'cors';
import path from 'path';

import { onConnection } from './ws-app';

const app = express();

app.use(cors());

app.use(express.static(path.join(process.cwd(), '../static')));

app.use('/', function(req, res) {
  res.json({
    author: 'Liu Chaofan (laearon)',
    code: 404
  });
});

const server = http.createServer(app);
const ws = new WebSocket.Server({ server });

ws.on('connection', onConnection);

ws.on('error', err => {
  console.error(err);
});

server.listen(4321, function(err) {
  if (err) {
    throw err;
  }
  console.log('server running at port 4321');
});
