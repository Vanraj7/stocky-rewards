// src/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');
const { scheduleHourly } = require('./scheduler');

const app = express();
app.use(bodyParser.json());

app.use('/', routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Stocky backend listening on http://localhost:${PORT}`);
  // start scheduler
  scheduleHourly();
});
