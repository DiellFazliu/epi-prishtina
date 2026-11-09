/**
 * Axios client me interceptors për JWT.
 * Version i përmirësuar që nuk ridirekton në login për gabime 401 të përkohshme.
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

// ═══ REQUEST interceptor — shto token ═══
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ═══ RESPONSE interceptor — rifresko token në 401 ═══
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Mos bëj refresh për endpoint-in e login/refresh
    const isAuthEndpoint = originalRequest.url?.includes('/auth/login') ||
                           originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          if (!refreshPromise) {
            refreshPromise = axios.post(`${API_URL}/auth/refresh`, {
              refresh_token: refreshToken,
            }).finally(() => {
              refreshPromise = null;
            });
          }
          const response = await refreshPromise;

          const { access_token, refresh_token } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return client(originalRequest);
        } catch (refreshError) {
          // Vetëm nëse refresh VËRTET dështon
          console.error('Token refresh failed:', refreshError);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');

          // Ridirekto në login VETËM nëse nuk jemi tashmë aty
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }
    }

    // Për të gjitha gabimet e tjera, kthe gabimin pa redirect
    return Promise.reject(error);
  }
);

export default client;