// server.js
const express = require('express');

const cors = require('cors');
const app = express();

const robotRouter = require('./src/routes/robotRouter');


app.use(cors());
app.use(express.json());


app.use('/robot/status', robotRouter)


module.exports = app;










