const router = require('express').Router();
const c = require('../controllers/installations.controller');
const w = require('../controllers/installations.write.controller');
const r = require('../controllers/readings.controller');
const rw = require('../controllers/readings.write.controller');
const { Installation } = require('../models');
const { validateId } = require('../utils/ids');
const { requireScope, requireOwnInstallation } = require('../middleware/auth');
const { guard } = require('../middleware/jurisdiction');

router.param('installationId', validateId);
router.param('readingId', validateId);

const read = requireScope('analyst:read');
const admin = requireScope('admin:write');
const device = requireScope('installation:write');
const own = guard(Installation, 'installationId', 'Installation');

// Installations (read: analysts and admins; write: admins)
router.get('/', read, c.listInstallations);
router.post('/', admin, w.createInstallation);
router.get('/:installationId', read, own, c.getInstallation);
router.put('/:installationId', admin, own, w.replaceInstallation);
router.patch('/:installationId', admin, own, w.updateInstallation);
router.delete('/:installationId', admin, own, w.deleteInstallation);

// Derived and composite resources
router.get('/:installationId/detail', read, own, c.getInstallationDetail);
router.get('/:installationId/last-reading', read, own, c.getLastReading);

// Readings: devices write their own, analysts read in scope, admins correct
router.get('/:installationId/readings', read, own, r.listInstallationReadings);
router.post('/:installationId/readings', device, requireOwnInstallation, rw.createReading);
router.get('/:installationId/readings/:readingId', read, own, r.getReading);
router.delete('/:installationId/readings/:readingId', admin, own, rw.deleteReading);
router.put('/:installationId/readings/:readingId', rw.notAllowed);
router.patch('/:installationId/readings/:readingId', rw.notAllowed);

module.exports = router;