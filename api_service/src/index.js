const express = require('express');
const app = express();
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

morgan('dev');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet());
app.use(cors());

app.use('/api/v1/composition', require('./controllers/api_v1'));

app.listen(process.env.PORT);
console.log(`Server is running on port ${process.env.PORT}`);
