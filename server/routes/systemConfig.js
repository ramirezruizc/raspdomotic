const express = require('express');
const router = express.Router();
const SystemConfig = require('../models/SystemConfig');
const User = require('../models/User');
const { authMiddleware, isAdminMiddleware } = require('../middleware/auth');
const logEvent = require('../utils/logEvent');

// Obtener la config global del sistema
router.get('/', async (req, res) => {
  const config = await SystemConfig.findOne() || await SystemConfig.create({});
  const userCount = await User.countDocuments();

  res.json({
    ...config.toObject(),
    usersExist: userCount > 0
  });
});

// Modificar (solo sesión con token válido y además, usuario es admin)
router.put('/', authMiddleware, isAdminMiddleware, async (req, res) => {
  const config = await SystemConfig.findOne() || await SystemConfig.create({});
  config.allowRegistration = req.body.allowRegistration;
  config.maintenanceMode = req.body.maintenanceMode;
  config.updatedAt = Date.now();

  await config.save();
  
  // Registra cambio de config en sistema
  await logEvent({
    eventType: 'updated_systemConfig',
    user: req.user._id,
    additionalInfo: {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  });

  res.json({ message: 'Configuración actualizada' });
});

module.exports = router;