import client from './client';

export const dashboardAPI = {
  getSummary: async () => {
    const response = await client.get('/dashboard/summary');
    return response.data;
  },

  getHealth: async () => {
    const response = await client.get('/dashboard/health');
    return response.data;
  },
};