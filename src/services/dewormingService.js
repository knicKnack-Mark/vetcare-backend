import api from './api';
export const dewormingService = {
  getAll: (params) => api.get('/dewormings', { params }).then((r) => r.data),
  getById: (id) => api.get(`/dewormings/${id}`).then((r) => r.data),
  getSummary: () => api.get('/dewormings/summary').then((r) => r.data),
  create: (data) => api.post('/dewormings', data).then((r) => r.data),
  update: (id, data) => api.put(`/dewormings/${id}`, data).then((r) => r.data),
};