const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  allowRegistration: { type: Boolean, default: false },
  maintenanceMode: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'systemconfig' });

module.exports = mongoose.model('SystemConfig', configSchema);