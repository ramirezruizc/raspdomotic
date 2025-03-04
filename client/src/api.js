/*
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://192.168.1.4:5000/api', // URL base del servidor
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Envía cookies automáticamente
});

export default api;
*/

import axios from 'axios';
import router from '@/router';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  //withCredentials: true, // Necesario para enviar cookies (token) con cada solicitud
  withCredentials: false, // Si Node-RED no usa autenticación, debe ser false
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      const errorMessage = error.response.data?.message || '';

      // Solo mostrar el alert si el error es por token expirado o inválido
      if (errorMessage.includes('Token inválido') || errorMessage.includes('Token expirado')) {
        alert("⚠️ Tu sesión ha expirado. Inicia sesión nuevamente.");
        router.push('/login');  // Redirige al login
      }
    }

    return Promise.reject(error);
  }
);

export default api;

/*
import axios from 'axios';

// Determinar si el origen de la petición es de la red local o de la WAN
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '192.168.1.4';

const api = axios.create({
  baseURL: isLocal ? 'http://192.168.1.4:5000/api' : 'http://raspdomotic.ddns.net:5000/api', // Cambiar según el entorno
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Envía cookies automáticamente
});

export default api;
*/