const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1); // so req.protocol is "https" behind Render/Railway
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/provinces', require('./routes/provinces.routes'));
app.use('/districts', require('./routes/districts.routes'));
app.use('/substations', require('./routes/substations.routes'));
app.use('/installations', require('./routes/installations.routes'));

app.use(notFoundHandler);
app.use(errorHandler); // must be last

module.exports = app;