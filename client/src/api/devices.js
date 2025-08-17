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

export const getPhoneNumbers = async () => {
  try {
    const res = await api.get('/devices/get-phone-numbers');
    return res.data.numbers || [];
  } catch (err) {
    console.error('❌ Error al obtener números de telefono desde backend:', err);
    return [];
  }
};

export function getDeviceAccess() {
  return api.get('/devices/get-device-access').then(res => res.data);
}

export async function updateDeviceAccess(deviceId, data) {
  await api.patch(`devices/${deviceId}/access-control`, data);
}

export async function refreshDevicesFromNodeRed() {
  try {
    const response = await api.post('/devices/load-from-nodered');
    return response.data;
  } catch (error) {
    console.error('Error al refrescar dispositivos desde Node-RED:', error);
    throw error;
  }
}