const crypto = require('crypto');

// Newest date in a list (ignores null/undefined)
const maxDate = (dates) =>
  dates.filter(Boolean).reduce((a, b) => (a && a > b ? a : b), null);

// Sends JSON with ETag + Last-Modified, and answers 304 (empty body)
// when the client's If-None-Match / If-Modified-Since is still current.
function sendJson(req, res, body, lastModified) {
  const json = JSON.stringify(body);
  const etag = `"${crypto.createHash('sha1').update(json).digest('hex')}"`;

  res.set('ETag', etag);
  if (lastModified) res.set('Last-Modified', new Date(lastModified).toUTCString());
  res.set('Cache-Control', 'private, no-cache'); // store it, but always revalidate

  if (req.fresh) return res.status(304).end(); // checks both headers; If-None-Match wins
  res.type('application/json').send(json);
}

module.exports = { sendJson, maxDate };