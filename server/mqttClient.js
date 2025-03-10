const mqtt = require('mqtt');

// Configuración del cliente MQTT
const client = mqtt.connect('mqtt://192.168.1.4'); // Cambia por la IP del broker MQTT

client.on('connect', () => {
  console.log('✅ Conectado al broker MQTT');
});

client.on('error', (err) => {
  console.error('Error en la conexión MQTT:', err);
});

// Exportar una función para publicar mensajes
const publishMessage = (topic, message) => {
  client.publish(topic, message, (err) => {
    if (err) {
      console.error('Error al publicar mensaje:', err);
    } else {
      console.log(`Mensaje publicado: ${topic} - ${message}`);
    }
  });
};

module.exports = { publishMessage };
