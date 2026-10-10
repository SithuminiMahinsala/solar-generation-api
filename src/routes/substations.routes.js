const router = require('express').Router();
const geo = require('../controllers/geography.controller');
const inst = require('../controllers/installations.controller');
const r = require('../controllers/readings.controller');
const { validateId } = require('../utils/ids');

router.param('substationId', validateId);

router.get('/:substationId', geo.getSubstation);
router.get('/:substationId/installations', inst.listInstallationsInSubstation);
router.get('/:substationId/readings', r.listSubstationReadings);

module.exports = router;