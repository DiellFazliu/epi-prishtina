import client from './client';

export const authAPI = {
  login: async (username, password) => {
    const response = await client.post('/auth/login', { username, password });
    return response.data;
  },

  register: async (userData) => {
    const response = await client.post('/auth/register', userData);
    return response.data;
  },

  getMe: async () => {
    const response = await client.get('/auth/me');
    return response.data;
  },

  refresh: async (refreshToken) => {
    const response = await client.post('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  },

  changePassword: async (oldPassword, newPassword) => {
    const response = await client.post('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return response.data;
  },
};