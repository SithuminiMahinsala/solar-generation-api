const router = require('express').Router();
const c = require('../controllers/installations.controller');
const r = require('../controllers/readings.controller');
const { validateId } = require('../utils/ids');


router.param('installationId', validateId);
router.param('readingId', validateId);

router.get('/', c.listInstallations);
router.get('/:installationId', c.getInstallation);
router.get('/:installationId/detail', c.getInstallationDetail);
router.get('/:installationId/last-reading', c.getLastReading);
router.get('/:installationId/readings', r.listInstallationReadings);
router.get('/:installationId/readings/:readingId', r.getReading);

module.exports = router;