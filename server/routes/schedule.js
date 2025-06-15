const express = require('express');
const router = express.Router();
const DeviceSchedule = require('../models/DeviceSchedule');
const { authMiddleware } = require('../middleware/auth');

// GET /api/v1/schedule/:deviceId
router.get('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const schedule = await DeviceSchedule.findOne({ deviceId: req.params.deviceId });

    if (!schedule) {
      return res.json({ success: true, schedule: { days: [], slots: [], enforceOutsideSlot: false } });
    }

    res.json({ success: true, schedule });
  } catch (err) {
    console.error("❌ Error al obtener la planificación:", err);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// POST /api/v1/schedule/:deviceId
router.post('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const { days, slots, enforceOutsideSlot } = req.body;

    if (!Array.isArray(days) || !Array.isArray(slots)) {
      return res.status(400).json({ success: false, message: 'Formato inválido' });
    }

    const updated = await DeviceSchedule.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      { days, slots, enforceOutsideSlot },
      { upsert: true, new: true }
    );

    res.json({ success: true, schedule: updated });
  } catch (err) {
    console.error("❌ Error al guardar la planificación:", err);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

module.exports = router;