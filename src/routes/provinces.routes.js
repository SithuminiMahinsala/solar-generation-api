const router = require('express').Router();
const c = require('../controllers/geography.controller');
const r = require('../controllers/readings.controller');
const { Province } = require('../models');
const { validateId } = require('../utils/ids');
const { requireScope } = require('../middleware/auth');
const { guard } = require('../middleware/jurisdiction');

router.param('provinceId', validateId);

const read = requireScope('analyst:read');
const own = guard(Province, 'provinceId', 'Province');

router.get('/', read, c.listProvinces);
router.get('/:provinceId', read, own, c.getProvince);
router.get('/:provinceId/districts', read, own, c.listDistrictsInProvince);
router.get('/:provinceId/readings', read, own, r.listProvinceReadings);

module.exports = router;