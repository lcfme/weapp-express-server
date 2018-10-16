import http from 'http';
import express from 'express';
import WebSocket from 'ws';
import cors from 'cors';
import path from 'path';

const app = express();

app.use(cors());

app.use('/', function(req, res) {
  res.json({
    msg: 'ok'
  });
});

const server = http.createServer(app);

const ws = new WebSocket.Server({ server });

server.listen(4321, function(err) {
  if (err) {
    throw err;
  }
  console.log('server running at port 4321');
});
