const router = require('express').Router();
const c = require('../controllers/geography.controller');
const r = require('../controllers/readings.controller');
const { validateId } = require('../utils/ids');

router.param('districtId', validateId);

router.get('/:districtId', c.getDistrict);
router.get('/:districtId/substations', c.listSubstationsInDistrict);
router.get('/:districtId/readings', r.listDistrictReadings);

module.exports = router;