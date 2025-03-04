module.exports = (socket, io) => {
    socket.on('toggle-alarm', (data) => {
        console.log(`Alarma activada por usuario ${socket.user.id}:`, data);

        // Notificar a todos los clientes que la alarma ha cambiado
        io.emit('alarm-updated', data);
    });
};