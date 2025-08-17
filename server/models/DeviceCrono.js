const mongoose = require("mongoose");

const deviceCronoSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  startedAt: { type: Date, required: true },
  duration: { type: Number, required: true }, // en segundos
  isCustom: { type: Boolean, default: false } // boton custom del frontend
});

module.exports = mongoose.model("DeviceCrono", deviceCronoSchema);