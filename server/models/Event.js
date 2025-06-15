const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  eventType: { // Tipo de evento: 'alarm_connected', 'intrusion', 'bulb_on', 'bulb_off', 'camera_access', etc.
    type: String, 
    required: true
  },
  timestamp: { // Fecha y hora del evento
    type: Date,
    default: Date.now
  },
  user: { // Usuario que ha realizado la acción, si aplica
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Referencia al modelo de usuario
    required: false
  },
  device: { // Información sobre el dispositivo involucrado en el evento
    type: String, 
    required: false
  },
  additionalInfo: { // Información adicional, por ejemplo, duración de la intrusión, razón del acceso a la cámara, etc.
    type: mongoose.Schema.Types.Mixed,
    required: false
  }
});

module.exports = mongoose.model('Event', EventSchema);