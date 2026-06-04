import client from './client'

export const calendarApi = {
  list: (params) => client.get('/calendar/', { params }).then(r => r.data),
  create: (data) => client.post('/calendar/', data).then(r => r.data),
  update: (id, data) => client.patch(`/calendar/${id}`, data).then(r => r.data),
  delete: (id) => client.delete(`/calendar/${id}`),
  triggerSync: () => client.post('/sync/').then(r => r.data),
  syncStatus: () => client.get('/sync/status').then(r => r.data),
  splitEvent: (id, data) => client.post(`/calendar/${id}/split`, data).then(r => r.data),
}
