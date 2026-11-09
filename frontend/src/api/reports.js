import client from './client';

export const reportsAPI = {
  list: async (params = {}) => {
    const response = await client.get('/reports', { params });
    return response.data;
  },

  get: async (id) => {
    const response = await client.get(`/reports/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await client.post('/reports', data);
    return response.data;
  },

  createAuthenticated: async (data) => {
    const response = await client.post('/reports/authenticated', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await client.patch(`/reports/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    await client.delete(`/reports/${id}`);
  },

  getStatistics: async (hours) => {
    const params = hours ? { hours } : {};
    const response = await client.get('/reports/statistics', { params });
    return response.data;
  },
};