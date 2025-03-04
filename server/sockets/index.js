// /server/sockets/index.js
module.exports = (io) => {
    io.on("connection", (socket) => {
        console.log(`Cliente conectado: ${socket.id} (User: ${socket.user.email})`);

        // Escuchar evento para cambio de estado de alarma
        socket.on("updateAlarma", (data) => {
            console.log(`Alarma actualizada a: ${data.estado} por ${socket.user.email}`);
            // Emitir a todos los clientes el nuevo estado de la alarma
            io.emit("alarma_actualizada", { estado: data.estado });
        });

        socket.on("disconnect", () => {
            console.log(`Cliente desconectado: ${socket.id}`);
        });
    });
};
