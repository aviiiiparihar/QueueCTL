// src/models/DLQ.js
const { Schema } = require('mongoose');

const DLQSchema = new Schema({
  id: { type: String, required: true },
  original: { type: Object, required: true },
  moved_at: { type: Date, default: () => new Date() },
  reason: { type: String, default: null }
}, { collection: 'dlq' });

module.exports = (mongoose) => mongoose.model('DLQ', DLQSchema);
