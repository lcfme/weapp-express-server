import express from 'express';

const app = express();

app.use('/', function(req, res) {
  res.json({
    msg: 'ok'
  });
});

app.listen(4321, function(err) {
  if (err) {
    throw err;
  }
  console.log('server running at port 4321');
});
