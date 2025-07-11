const express = require('express');
const router = express.Router();
const SystemConfig = require('../models/SystemConfig');
const User = require('../models/User');
const Role = require('../models/Role');
const { authMiddleware, isAdminMiddleware } = require('../middleware/auth');
const logEvent = require('../utils/logEvent');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Obtener la config global del sistema
router.get('/', async (req, res) => {
  const config = await SystemConfig.findOne() || await SystemConfig.create({});
  const hasSuperUser = await User.exists({ role: 's-user' });

  // Generamos un usuario "system" con su ObjectId que se use
  // en la generación de eventos desde "sistema" Node-RED,
  // de modo que mantenemos integridad referencial
  // para poder hacer joins/poblados entre eventos y usuarios
  // Verificar si ya existe un usuario "system"
  let systemUser = await User.findOne({ username: 'system' });

  //Si no existe usuario 'system' estamos ante un nuevo despliegue
  //de la solución. Creamos roles por defecto en el sistema
  //ademas del usuario inetrno 'system' propio del sistema
  if (!systemUser) {
    const defaultRoles = [
      { name: 's-user', description: 'Rol Superusuario' },
      { name: 'admin', description: 'Rol Administrador del sistema', color: '#ff9800' },
      { name: 'system', description: 'Rol Usuario interno del sistema' },
      { name: 'user', description: 'Rol Usuario estándar', color: '#007bff' },
      { name: 'dashboard', description: 'Rol analítica', color: '#33d1ff' } 
    ];

    for (const roleData of defaultRoles) {
      const exists = await Role.findOne({ name: roleData.name });
      if (!exists) {
        await Role.create(roleData);
        console.log(`⚙️ Rol '${roleData.name}' creado`);
      }
    }

    systemUser = new User({
      username: 'system',
      password: 'unuse', // Campo obligatorio, aunque sin uso para login
      role: ['system'],
      isSystem: true
    });

    await systemUser.save();
    console.log(`⚙️ Usuario 'system' creado con _id: ${systemUser._id}`);

    // Path de trabajo local del contenedor Docker de Node-RED
    const noderedDataPath = path.join(os.homedir(), 'modules/docker/containers/node-red/data');
    const filePath = path.join(noderedDataPath, 'system-user.json');

    try {
      fs.writeFileSync(filePath, JSON.stringify({ id: systemUser._id.toString() }, null, 2));
      console.log('✅ System user ID guardado en fichero:', filePath);
    } catch (err) {
      console.error('❌ Error al escribir system-user.json:', err.message);
    }
  }
 
  res.json({
    ...config.toObject(),
    initialSetup: !hasSuperUser
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