// src/models/Config.js
const { Schema } = require('mongoose');

const ConfigSchema = new Schema({
  key: { type: String, unique: true },
  value: { type: Schema.Types.Mixed }
}, { collection: 'config' });

module.exports = (mongoose) => mongoose.model('Config', ConfigSchema);
