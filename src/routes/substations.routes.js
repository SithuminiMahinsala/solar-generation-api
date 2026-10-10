const router = require('express').Router();
const geo = require('../controllers/geography.controller');
const inst = require('../controllers/installations.controller');
const { validateId } = require('../utils/ids');

router.param('substationId', validateId);

router.get('/:substationId', geo.getSubstation);
router.get('/:substationId/installations', inst.listInstallationsInSubstation);

module.exports = router;