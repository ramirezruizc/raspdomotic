const mqtt = require('mqtt');

const options = {
  reconnectPeriod: 5 * 1000, // Intentar reconectar cada 5 segundos
  connectTimeout: 10 * 1000, // Tiempo máximo de espera para conexión
  clientId: `Raspi.local_mqtt_client_${Math.random().toString(16).slice(2, 10)}`, // Evitar conflictos de cliente
  clean: false // El cliente recordará suscripciones previas, QoS 1 y 2 se entregan cuando reconecte
};

// Configuración del cliente MQTT
const client = mqtt.connect('mqtt://192.168.1.4', options); // Cambia por la IP del broker MQTT

client.on('connect', () => {
  console.log('✅ Conectado al broker MQTT');
});

client.on('error', (err) => {
  console.error('❌ Error en la conexión MQTT:', err);
});

client.on('reconnect', () => {
  console.log('🔄 Intentando reconectar...');
});

client.on('offline', () => {
  console.warn('⚠️ Cliente MQTT está offline');
});

client.on('close', () => {
  console.warn('🔌 Conexión cerrada con el broker MQTT');
});

// Exportar una función para publicar mensajes
const publishMessage = (topic, message) => {
  if (client.connected) {
    client.publish(topic, message, (err) => {
      if (err) {
        console.error('❌ Error al publicar mensaje:', err);
      } else {
        console.log(`📨 Mensaje publicado: ${topic} - ${message}`);
      }
    });
  } else {
    console.warn('⚠️ No se pudo publicar, cliente MQTT no está conectado');
  }
};

module.exports = { publishMessage };