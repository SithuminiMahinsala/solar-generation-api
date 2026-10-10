const router = require('express').Router();
const c = require('../controllers/geography.controller');
const { validateId } = require('../utils/ids');

router.param('provinceId', validateId);

router.get('/', c.listProvinces);
router.get('/:provinceId', c.getProvince);
router.get('/:provinceId/districts', c.listDistrictsInProvince);

module.exports = router;