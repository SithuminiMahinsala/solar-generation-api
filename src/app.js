const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const requireJson = require('./middleware/requireJson');
const requireJsonContentType = require('./middleware/requireJsonContentType');
const { globalLimiter } = require('./middleware/rateLimit');

const app = express();

app.set('trust proxy', 1); // req.protocol is "https" behind Render/Railway
app.use(helmet());
app.use(
  cors({ exposedHeaders: ['ETag', 'Last-Modified', 'Location', 'Allow', 'Retry-After'] })
);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' })); // not rate limited

app.use(globalLimiter);
app.use(express.json({ limit: '10kb' }));
app.use(requireJsonContentType);

// 406 check for every API resource
app.use(['/provinces', '/districts', '/substations', '/installations'], requireJson);

app.use('/provinces', require('./routes/provinces.routes'));
app.use('/districts', require('./routes/districts.routes'));
app.use('/substations', require('./routes/substations.routes'));
app.use('/installations', require('./routes/installations.routes'));

app.use(notFoundHandler);
app.use(errorHandler); // must be last

module.exports = app;