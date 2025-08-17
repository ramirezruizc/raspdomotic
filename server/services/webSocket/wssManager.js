const { isStreamingActive, setStreamingActive, getCameraViewers } = require('./shared/cameraState');

const WebSocket = require('ws');

let alarmTriggered = false;
//let streamingActive = false;

function initWss(server, io) {
    // Configurar WebSocket puro (ws)
    const wss = new WebSocket.Server({ noServer: true });

    //Peticiones Socket.io con URL '/ws' se redirigen a WS puro
    server.on("upgrade", (request, socket, head) => {
    if (request.url === "/ws") {
        console.log("🔄 Update de conexión. Socket.io a WebSocket puro");
        wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
        });
    }
    });

    //let cameraViewers = new Set(); // IDs de los clientes streaming
    let base64Image = null;

    wss.on("connection", (ws, request) => {
    console.log("🟢 Cliente WebSocket conectado");

    const isLikelyText = (buffer) => {
        const textSample = buffer.toString('utf8', 0, 24); // analiza solo una parte
        return /^[\x20-\x7E\s]*$/.test(textSample); // ASCII printable + espacio
    };

    ws.on("message", (message) => {
        try {
            // Verifica el mensaje recibido como buffer antes de convertirlo
            console.log("🔧 Mensaje recibido en formato Buffer. Procesando...");

            if (isLikelyText(message)) {
                // Convertimos el Buffer a texto para analizarlo
                const textMessage = message.toString().trim();
                //console.log("🔧 Mensaje recibido como texto:", textMessage);

                console.log("🔧 Mensaje convertido a texto:", textMessage);

                // Si el mensaje es "STATUS", responder directamente
                if (textMessage === "STATUS") {
                    console.log("🔄 Respondiendo al ESP32-CAM: 'BACKEND WS OK'");
                    ws.send("BACKEND WS OK");
                    return; // Salimos del handler sin hacer nada más
                }

                // Verificar si es JSON antes de intentar parsear
                if (textMessage.startsWith("{") && textMessage.endsWith("}")) {
                    console.log("📥 Comando recibido por JSON");
                    try {
                        // Si es JSON, lo procesamos
                        const data = JSON.parse(textMessage);
                        console.log(data);

                        switch (data.action) {
                            case "get_mode":
                                let mode = "idle";
                                if (alarmTriggered) {
                                    mode = "alarm";
                                    alarmTriggered = false;
                                } else if (isStreamingActive()) {
                                    mode = "stream";
                                }
                                console.log("Modo de trabajo para ESP32-CAM:", mode);
                                ws.send(JSON.stringify({ action: "mode", mode }));
                                break;
                            case "alarm-triggered":
                                console.log("🚨 Se ha producido una Alarma!");
                                alarmTriggered = true;
                                break;
                            case "bulb-status":
                                io.emit("bulb-status", { data });
                                break;
                            case "alarm-status":
                                io.emit("alarm-status", { status: data.status });
                                break;
                            default:
                                console.warn("⚠️ Acción desconocida recibida:", data.action);
                        }

                        return; // Si era JSON, terminamos aquí
                    } catch (err) {
                    console.error("❌ Error procesando JSON:", err);
                    }
                }
            }

            // Si no es JSON, asumimos que es binario (recurso imagen desde ESP32-CAM)
            console.log("📸 Frame recibido (stream activo)");
            base64Image = message.toString("base64");

            const viewers = getCameraViewers();
        
            // Reenviar stream solo a los usuarios que solicitaron
            if (viewers.size > 0) {
                io.to([...viewers]).emit("camera_frame", base64Image);
            } else {
                console.log("📴 Sin viewers → detener stream");
                mode = "stop-stream";
                setStreamingActive(false);
                base64Image = null;
                console.log("ESP32-CAM DeepSleep");
                ws.send(JSON.stringify({ action: "mode", mode }));
            }

            return;
        } catch (err) {
            console.error("❌ Error procesando mensaje:", err);
        }
        });

        ws.on("close", () => {
            console.log("🔴 Cliente WebSocket desconectado");
        });
    });

    return wss;
}  

module.exports = { initWss };