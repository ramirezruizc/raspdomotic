const WebSocket = require("ws");

const socket = new WebSocket("wss://raspdomotic.ddns.net");

socket.on("open", () => {
    console.log("🟢 Conectado al servidor WebSocket");
});

socket.on("message", (data) => {
    console.log("📩 Mensaje recibido:", data.toString());
});

socket.on("close", () => {
    console.log("🔴 Conexión cerrada");
});

socket.on("error", (error) => {
    console.error("❌ Error en WebSocket:", error.message);
});
