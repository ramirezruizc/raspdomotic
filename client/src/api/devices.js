import api from './api';

// Obtener dispositivos desde el sistema
export const getDevices = async () => {
  try {
    const response = await api.get('/devices/get-devices');
    return response.data;
  } catch (error) {
    console.error('Error al obtener los dispositivos:', error);
    throw error;
  }
};