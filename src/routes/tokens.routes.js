const router = require('express').Router();
const { issueToken } = require('../controllers/tokens.controller');

router.post('/', issueToken);

module.exports = router;