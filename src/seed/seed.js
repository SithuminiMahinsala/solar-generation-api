require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');

const { Province, District, Substation, Installation, Reading, User } = require('../models');
const { GEOGRAPHY, EXTRA_SUBSTATIONS } = require('./data');

// ---- Configuration ----
const INSTALLATION_COUNT = 240;
const DAYS = 7;
const INTERVAL_MIN = 15;
const READINGS_PER_INSTALLATION = (DAYS * 24 * 60) / INTERVAL_MIN; // 672
const INTERVAL_MS = INTERVAL_MIN * 60 * 1000;
const SL_UTC_OFFSET_HOURS = 5.5;
const FLUSH_SIZE = 5000;

const USER_PASSWORD = process.env.SEED_USER_PASSWORD;
if (!USER_PASSWORD) {
  console.error('SEED_USER_PASSWORD is missing from .env');
  process.exit(1);
}

// ---- Helpers ----

// 0 at night, sine curve peaking at solar noon (local time 06:00 to 18:00)
function solarFactor(date) {
  const localHour =
    (date.getUTCHours() + date.getUTCMinutes() / 60 + SL_UTC_OFFSET_HOURS) % 24;
  if (localHour < 6 || localHour > 18) return 0;
  return Math.sin((Math.PI * (localHour - 6)) / 12);
}

const round = (n, dp) => Number(n.toFixed(dp));

async function wipe() {
  await Promise.all(
    [Reading, Installation, Substation, District, Province, User].map((m) => m.deleteMany({}))
  );
  for (const m of [Province, District, Substation, Installation, Reading, User]) {
    await m.init(); // make sure indexes exist
  }
}

// ---- Main ----
async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to database: ${mongoose.connection.name}`);
  faker.seed(42);

  console.log('Clearing existing data...');
  await wipe();

  // 1. Provinces and districts
  const provinces = await Province.insertMany(
    GEOGRAPHY.map((p) => ({ name: p.name, code: p.code }))
  );
  const provinceByName = new Map(provinces.map((p) => [p.name, p]));

  const districts = await District.insertMany(
    GEOGRAPHY.flatMap((p) =>
      p.districts.map((d) => ({ name: d, provinceId: provinceByName.get(p.name)._id }))
    )
  );
  const districtByName = new Map(districts.map((d) => [d.name, d]));
  console.log(`Provinces: ${provinces.length}, Districts: ${districts.length}`);

  // 2. Substations (one per district, plus extras)
  const substationCount = new Map();
  const substationInputs = [...districts.map((d) => d.name), ...EXTRA_SUBSTATIONS].map(
    (districtName) => {
      const district = districtByName.get(districtName);
      const n = (substationCount.get(districtName) || 0) + 1;
      substationCount.set(districtName, n);
      return {
        name: `${districtName} Grid Substation ${String.fromCharCode(64 + n)}`,
        capacityMva: faker.helpers.arrayElement([31.5, 63, 90, 120]),
        districtId: district._id,
        provinceId: district.provinceId,
      };
    }
  );
  const substations = await Substation.insertMany(substationInputs);
  console.log(`Substations: ${substations.length}`);

  // 3. Installations
  const deviceSecrets = [];
  const installationInputs = [];
  for (let i = 0; i < INSTALLATION_COUNT; i++) {
    // first pass gives every substation at least one installation
    const sub =
      i < substations.length ? substations[i] : faker.helpers.arrayElement(substations);
    const meterId = `SLSEA-M-${String(i + 1).padStart(5, '0')}`;
    const secret = crypto.randomBytes(16).toString('hex');
    deviceSecrets.push({ meterId, secret });

    installationInputs.push({
      name: `${faker.person.lastName()} Residence Rooftop`,
      meterId,
      capacityKw: faker.helpers.arrayElement([3, 5, 5, 8, 10, 15, 25, 50]),
      installDate: faker.date.past({ years: 4 }),
      status: faker.helpers.weightedArrayElement([
        { weight: 90, value: 'active' },
        { weight: 5, value: 'maintenance' },
        { weight: 5, value: 'inactive' },
      ]),
      location: {
        latitude: round(faker.number.float({ min: 6.0, max: 9.8 }), 5),
        longitude: round(faker.number.float({ min: 79.8, max: 81.8 }), 5),
        address: faker.location.streetAddress(),
      },
      substationId: sub._id,
      districtId: sub.districtId,
      provinceId: sub.provinceId,
    });
  }

  console.log('Hashing device secrets...');
  const hashes = await Promise.all(deviceSecrets.map((d) => bcrypt.hash(d.secret, 10)));
  installationInputs.forEach((inst, i) => {
    inst.deviceSecretHash = hashes[i];
  });

  const installations = await Installation.insertMany(installationInputs);
  console.log(`Installations: ${installations.length}`);

  // 4. Users
  const passwordHash = await bcrypt.hash(USER_PASSWORD, 10);
  const users = [
    { name: 'National Analyst', email: 'national@slsea.lk', role: 'analyst', jurisdictionLevel: 'national' },
    { name: 'Western Province Analyst', email: 'western.province@slsea.lk', role: 'analyst', jurisdictionLevel: 'province', jurisdictionId: provinceByName.get('Western')._id },
    { name: 'Colombo District Analyst', email: 'colombo.district@slsea.lk', role: 'analyst', jurisdictionLevel: 'district', jurisdictionId: districtByName.get('Colombo')._id },
    { name: 'Gampaha District Analyst', email: 'gampaha.district@slsea.lk', role: 'analyst', jurisdictionLevel: 'district', jurisdictionId: districtByName.get('Gampaha')._id },
    { name: 'Kandy District Analyst', email: 'kandy.district@slsea.lk', role: 'analyst', jurisdictionLevel: 'district', jurisdictionId: districtByName.get('Kandy')._id },
    { name: 'System Admin', email: 'admin@slsea.lk', role: 'admin', jurisdictionLevel: 'national' },
  ].map((u) => ({ ...u, passwordHash }));
  await User.insertMany(users);
  console.log(`Users: ${users.length}`);

  // 5. Readings (raw driver for speed; data is generated by trusted code)
  const end = new Date(Math.floor(Date.now() / INTERVAL_MS) * INTERVAL_MS);
  const startMs = end.getTime() - (READINGS_PER_INSTALLATION - 1) * INTERVAL_MS;

  const weather = new Map(); // "districtId-dayIndex" -> cloud factor
  const weatherFor = (districtId, dayIdx) => {
    const key = `${districtId}-${dayIdx}`;
    if (!weather.has(key)) weather.set(key, faker.number.float({ min: 0.55, max: 1 }));
    return weather.get(key);
  };

  let buffer = [];
  let total = 0;
  const flush = async () => {
    if (!buffer.length) return;
    await Reading.collection.insertMany(buffer, { ordered: false });
    total += buffer.length;
    buffer = [];
    process.stdout.write(`\rReadings inserted: ${total}`);
  };

  for (const inst of installations) {
    let energyKwh = faker.number.float({ min: 500, max: 20000 }); // meter counter base
    for (let i = 0; i < READINGS_PER_INSTALLATION; i++) {
      const ts = new Date(startMs + i * INTERVAL_MS);
      const dayIdx = Math.floor(i / 96);
      const noise = faker.number.float({ min: 0.93, max: 1 });
      const powerKw = round(
        inst.capacityKw * 0.85 * solarFactor(ts) * weatherFor(inst.districtId, dayIdx) * noise,
        3
      );
      energyKwh += powerKw * (INTERVAL_MIN / 60);

      buffer.push({
        installationId: inst._id,
        districtId: inst.districtId,
        provinceId: inst.provinceId,
        substationId: inst.substationId,
        timestamp: ts,
        powerKw,
        energyKwh: round(energyKwh, 3),
        voltage: round(230 + faker.number.float({ min: -5, max: 10 }), 1),
        createdAt: ts,
      });
      if (buffer.length >= FLUSH_SIZE) await flush();
    }
  }
  await flush();
  console.log(`\nReadings: ${total}`);

  // 6. Save device credentials (git-ignored)
  const outDir = path.join(__dirname, '..', '..', 'seed-output');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'credentials.json'),
    JSON.stringify(
      {
        note: 'Demo credentials. Never commit this file.',
        users: users.map((u) => ({ email: u.email, level: u.jurisdictionLevel, role: u.role })),
        userPassword: 'see SEED_USER_PASSWORD in .env',
        devices: deviceSecrets,
      },
      null,
      2
    )
  );
  console.log('Credentials written to seed-output/credentials.json');

  await mongoose.disconnect();
  console.log('Seed complete.');
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});