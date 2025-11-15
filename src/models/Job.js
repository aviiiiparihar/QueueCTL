// src/models/Job.js
const { Schema } = require('mongoose');

const JobSchema = new Schema({
  id: { type: String, required: true, unique: true },
  command: { type: String, required: true },
  state: { type: String, enum: ['pending','processing','completed','failed','dead'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  max_retries: { type: Number, default: 3 },
  created_at: { type: Date, default: () => new Date() },
  updated_at: { type: Date, default: () => new Date() },
  next_run_at: { type: Date, default: () => new Date() },
  last_error: { type: String, default: null },
  worker_id: { type: String, default: null }
}, { collection: 'jobs' });

JobSchema.index({ state: 1, next_run_at: 1 });

module.exports = (mongoose) => mongoose.model('Job', JobSchema);
