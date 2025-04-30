import api from './api';

export const getEventSummary = async (filters) => {
  const response = await api.get('/events/summary', {
    params: filters
  });
  return response.data;
};

export const getEventTypes = async (start, end) => {
  const response = await api.get('/events/event-types', {
    params: { start, end }
  });
  return response.data;
};