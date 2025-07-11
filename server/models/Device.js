const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String },
  type: { type: String, default: '' },
  restricted: { type: Boolean, default: true },
  accessRoles: { type: [String], default: [] }
});

module.exports = mongoose.model('Device', DeviceSchema);