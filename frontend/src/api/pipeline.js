/**
 * API client për pipeline endpoints.
 */

import client from './client';

export const pipelineAPI = {
  /**
   * Merr gjendjen aktuale të sistemit.
   */
  getState: async () => {
    const response = await client.get('/pipeline/state');
    return response.data;
  },

  /**
   * Rifresko hotspots (trajno ML + parashiko).
   */
  refreshHotspots: async () => {
    const response = await client.post('/pipeline/refresh');
    return response.data;
  },

  /**
   * Gjenero rekomandimet.
   */
  generateRecommendations: async () => {
    const response = await client.post('/pipeline/recommend');
    return response.data;
  },

  getLatestRecommendation: async () => {
    const response = await client.get('/pipeline/recommendation');
    return response.data;
  },

  getHistory: async (params = {}) => {
    const response = await client.get('/pipeline/history', { params });
    return response.data;
  },

  getHistorySnapshot: async (snapshotId) => {
    const response = await client.get(`/pipeline/history/${snapshotId}`);
    return response.data;
  },

  /**
   * Apliko rekomandimet e zgjedhura.
   * @param {string[]} selectedIds - ID-të e rekomandimeve (null = të gjitha)
   * @param {number} daysAhead - Ditët përpara
   */
  applyRecommendations: async (selectedIds = null, daysAhead = 30) => {
    const response = await client.post('/pipeline/apply', {
      selected_ids: selectedIds,
      days_ahead: daysAhead,
    });
    return response.data;
  },

  /**
   * Simulo përpara dhe krahaso.
   * @param {number} daysAhead - Ditët përpara
   */
  simulateForward: async (daysAhead = 30) => {
    const response = await client.post('/pipeline/simulate', {
      days_ahead: daysAhead,
    });
    return response.data;
  },

  /**
   * Merr krahasimin e fundit të ruajtur.
   */
  getComparison: async () => {
    const response = await client.get('/pipeline/comparison');
    return response.data;
  },

  getLive: async () => {
    const response = await client.get('/pipeline/live');
    return response.data;
  },

  setLive: async (running) => {
    const response = await client.post('/pipeline/live/toggle', null, {
      params: { running },
    });
    return response.data;
  },
};