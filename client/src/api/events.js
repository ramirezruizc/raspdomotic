import api from './api';

//Obtener resultados de la consulta lanzada al sistema
export const getEventSummary = async (filters) => {
  const response = await api.get('/events/summary', {
    params: filters
  });
  return response.data;
};

//Obtener los diferentes tipos de eventos definidos en el sistema
export const getEventTypes = async (start, end) => {
  const response = await api.get('/events/event-types', {
    params: { start, end }
  });
  return response.data;
};