const router = require('express').Router();
const c = require('../controllers/geography.controller');
const { validateId } = require('../utils/ids');

router.param('districtId', validateId);

router.get('/:districtId', c.getDistrict);
router.get('/:districtId/substations', c.listSubstationsInDistrict);

module.exports = router;