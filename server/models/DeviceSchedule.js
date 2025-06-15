const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  start: { type: String, required: true }, // formato "HH:mm"
  end: { type: String, required: true }
}, { _id: false });

const deviceScheduleSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  days: { type: [String], required: true }, // ["L", "M", "X", "J", "V", "S", "D"]
  slots: { type: [slotSchema], required: true },
  enforceOutsideSlot: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('DeviceSchedule', deviceScheduleSchema);