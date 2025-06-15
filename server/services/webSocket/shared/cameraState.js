//Servicio para gestionar el estado streaming
//de la cámara. Se hacen uso de dos tipos de
//WebSocket, uno mas "primitivo" para comunicarse
//con ESP32-CAM, y socket.io para gestión
//de clientes conectados mediante interfaz
//de usuario PWA. Sirve de enlace ya que hay
//información que debe compartirse entre los
//dos modos de comunicación WebSocket

let streamingActive = false;
const cameraViewers = new Set();

function isStreamingActive() {
  return streamingActive;
}

function setStreamingActive(value) {
  streamingActive = value;
}

function getCameraViewers() {
  return cameraViewers;
}

function addViewer(socketId) {
  cameraViewers.add(socketId);
  console.log(`👁️ Nuevo viewer añadido: ${socketId}. Total: ${cameraViewers.size}`);
  
  if (!streamingActive) {
    setStreamingActive(true);
  }
}

function removeViewer(socketId) {
  cameraViewers.delete(socketId);
  console.log(`🚫 Viewer eliminado: ${socketId}. Total: ${cameraViewers.size}`);

  if (cameraViewers.size === 0) {
    setStreamingActive(false);
    console.log("🛑 No quedan viewers → streaming desactivado");
  }
}

function clearViewers() {
  cameraViewers.clear();
  setStreamingActive(false);
  console.log("🧹 Todos los viewers eliminados y streaming desactivado");
}

module.exports = {
  isStreamingActive,
  setStreamingActive,
  getCameraViewers,
  addViewer,
  removeViewer,
  clearViewers
};