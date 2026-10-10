const crypto = require('crypto');
const ApiError = require('./ApiError');

const maxDate = (dates) =>
  dates.filter(Boolean).reduce((a, b) => (a && a > b ? a : b), null);

// Strong ETag: SHA-1 of the exact JSON body
const etagFor = (body) =>
  `"${crypto.createHash('sha1').update(JSON.stringify(body)).digest('hex')}"`;

function sendJson(req, res, body, lastModified) {
  const json = JSON.stringify(body);
  res.set('ETag', etagFor(body));
  if (lastModified) res.set('Last-Modified', new Date(lastModified).toUTCString());
  res.set('Cache-Control', 'private, no-cache');

  if (req.fresh) return res.status(304).end();
  res.type('application/json').send(json);
}

// If-Match: only proceed if the client's copy is still current, otherwise 412.
// No header (or "*") means no precondition was requested.
function checkIfMatch(req, currentEtag) {
  const header = req.get('If-Match');
  if (!header || header.trim() === '*') return;
  const tags = header.split(',').map((t) => t.trim().replace(/^W\//, ''));
  if (!tags.includes(currentEtag)) {
    throw ApiError.preconditionFailed('The resource has changed since you last fetched it', [
      { field: 'If-Match', issue: 'ETag does not match the current version' },
    ]);
  }
}

module.exports = { sendJson, maxDate, etagFor, checkIfMatch };