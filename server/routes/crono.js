const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { addCrono, getCrono, removeCrono } = require('../services/crono/cronoExecutor');

// Ruta GET para obtener el crono activo de un dispositivo
router.get("/:deviceId/crono", authMiddleware, async (req, res) => {
    const { deviceId } = req.params;

    try {
        const crono = getCrono(deviceId);

        if (!crono) {
            return res.json({ active: false });
        }

        const remaining = Math.max(0, Math.floor((crono.endAt - Date.now()) / 1000));
        
        if (remaining <= 0) {
            // Expirado pero no eliminado aún
            return res.json({ success: true, active: false });
        }

        return res.json({
            success: true,
            active: true,
            remaining,
            startedAt: crono.startedAt,
            duration: crono.duration,
            isCustom: crono.isCustom
        });

    } catch (err) {
        console.error("❌ Error al obtener estado del crono:", err);
        res.status(500).json({ success: false, message: "Error al consultar crono" });
    }
});

// Ruta POST para crear o actualizar un crono manualmente (si ya está encendido)
router.post("/:deviceId/crono", authMiddleware, async (req, res) => {
    const { deviceId } = req.params;
    const { duration, isCustom } = req.body;

    if (!duration || isNaN(duration)) {
        return res.status(400).json({ success: false, message: "Duración inválida" });
    }

    try {
        await addCrono(deviceId, duration * 60, isCustom);
        return res.json({ success: true });
    } catch (err) {
        console.error("❌ Error al persistir crono:", err);
        return res.status(500).json({ success: false, message: "Error al guardar crono" });
    }
});

// DELETE: cancelar crono manualmente
router.delete('/:deviceId/crono', authMiddleware, async (req, res) => {
    const { deviceId } = req.params;

    try {
        await removeCrono(deviceId);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ Error al eliminar crono:", err);
        res.status(500).json({ success: false, message: "Error al eliminar crono" });
    }
});

module.exports = router;