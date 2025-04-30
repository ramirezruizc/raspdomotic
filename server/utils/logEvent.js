const Event = require('../models/Event');

async function logEvent({ eventType, user = null, device = null, additionalInfo = {} }) {
  try {
    await Event.create({
      eventType,
      user,
      device,
      additionalInfo
    });
  } catch (err) {
    console.error('❌ Error al registrar evento:', err);
  }
}

module.exports = logEvent;