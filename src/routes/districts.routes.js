const router = require('express').Router();
const c = require('../controllers/geography.controller');
const r = require('../controllers/readings.controller');
const { District } = require('../models');
const { validateId } = require('../utils/ids');
const { requireScope } = require('../middleware/auth');
const { guard } = require('../middleware/jurisdiction');
const s = require('../controllers/summary.controller');

router.param('districtId', validateId);

const read = requireScope('analyst:read');
const own = guard(District, 'districtId', 'District');

router.get('/:districtId', read, own, c.getDistrict);
router.get('/:districtId/substations', read, own, c.listSubstationsInDistrict);
router.get('/:districtId/readings', read, own, r.listDistrictReadings);
router.get('/:districtId/generation-summary', read, own, s.getDistrictSummary);

module.exports = router;