function serialize(doc) {
  if (!doc) return null;
  if (Array.isArray(doc)) return doc.map(serialize);
  const { _id, __v, ...rest } = doc;
  return { id: String(_id), ...rest };
}

// Public shape of a reading (hides the denormalised scoping fields)
function serializeReading(r) {
  if (!r) return null;
  return {
    id: String(r._id),
    installationId: String(r.installationId),
    timestamp: r.timestamp,
    powerKw: r.powerKw,
    energyKwh: r.energyKwh,
    voltage: r.voltage,
  };
}

module.exports = { serialize, serializeReading };