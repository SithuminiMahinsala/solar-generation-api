const router = require('express').Router();
const c = require('../controllers/installations.controller');
const r = require('../controllers/readings.controller');
const w = require('../controllers/installations.write.controller');
const rw = require('../controllers/readings.write.controller');
const { validateId } = require('../utils/ids');

router.param('installationId', validateId);
router.param('readingId', validateId);


router.get('/', c.listInstallations);
router.get('/:installationId', c.getInstallation);
router.get('/:installationId/detail', c.getInstallationDetail);
router.get('/:installationId/last-reading', c.getLastReading);
router.get('/:installationId/readings', r.listInstallationReadings);
router.get('/:installationId/readings/:readingId', r.getReading);


router.post('/', w.createInstallation);
router.put('/:installationId', w.replaceInstallation);
router.patch('/:installationId', w.updateInstallation);
router.delete('/:installationId', w.deleteInstallation);

router.post('/:installationId/readings', rw.createReading);
router.delete('/:installationId/readings/:readingId', rw.deleteReading);
router.put('/:installationId/readings/:readingId', rw.notAllowed);
router.patch('/:installationId/readings/:readingId', rw.notAllowed);

module.exports = router;