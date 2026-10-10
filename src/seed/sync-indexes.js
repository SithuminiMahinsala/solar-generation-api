require('dotenv').config();
const mongoose = require('mongoose');
const { Reading } = require('../models');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Dropped:', await Reading.syncIndexes());
  console.log(await Reading.collection.indexes());
  await mongoose.disconnect();
})();