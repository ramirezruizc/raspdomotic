const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  color: { type: String, default: '#007bff' }
});

module.exports = mongoose.model('Role', RoleSchema);