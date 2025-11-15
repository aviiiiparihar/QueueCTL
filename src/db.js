// src/db.js
const mongoose = require('mongoose');

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/queuectl_db';

async function connect() {
  if (mongoose.connection.readyState === 1) return mongoose;
  await mongoose.connect(MONGO, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  return mongoose;
}

module.exports = { connect, mongoose };
