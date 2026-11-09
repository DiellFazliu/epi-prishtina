import client from './client';

export const usersAPI = {
  list: async (params = {}) => {
    const response = await client.get('/users', { params });
    return response.data;
  },

  get: async (id) => {
    const response = await client.get(`/users/${id}`);
    return response.data;
  },

  update: async (id, data) => {
    const response = await client.patch(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    await client.delete(`/users/${id}`);
  },
};