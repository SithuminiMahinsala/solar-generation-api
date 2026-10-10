const router = require('express').Router();
const c = require('../controllers/installations.controller');
const { validateId } = require('../utils/ids');

router.param('installationId', validateId);

router.get('/', c.listInstallations);
router.get('/:installationId', c.getInstallation);
router.get('/:installationId/detail', c.getInstallationDetail);
router.get('/:installationId/last-reading', c.getLastReading);

module.exports = router;