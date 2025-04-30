import api from './api';

// Obtener la configuración del sistema
export const getSystemConfig = async () => {
  try {
    const response = await api.get('/systemConfig/');
    return response.data;
  } catch (error) {
    console.error('Error al obtener la configuración del sistema:', error);
    throw error;
  }
};

// Actualizar la configuración del sistema
export const updateSystemConfig = async (config) => {
  try {
    const response = await api.put('/systemConfig/', config);
    return response.data;
  } catch (error) {
    console.error('Error al actualizar la configuración del sistema:', error);
    throw error;
  }
};