const router = require('express').Router();
const geo = require('../controllers/geography.controller');
const inst = require('../controllers/installations.controller');
const r = require('../controllers/readings.controller');
const { Substation } = require('../models');
const { validateId } = require('../utils/ids');
const { requireScope } = require('../middleware/auth');
const { guard } = require('../middleware/jurisdiction');

router.param('substationId', validateId);

const read = requireScope('analyst:read');
const own = guard(Substation, 'substationId', 'Substation');

router.get('/:substationId', read, own, geo.getSubstation);
router.get('/:substationId/installations', read, own, inst.listInstallationsInSubstation);
router.get('/:substationId/readings', read, own, r.listSubstationReadings);

module.exports = router;