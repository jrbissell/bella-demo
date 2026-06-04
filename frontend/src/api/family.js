import client from './client'

export const familyApi = {
  list: () => client.get('/family/').then(r => r.data),
  create: (data) => client.post('/family/', data).then(r => r.data),
  update: (id, data) => client.patch(`/family/${id}`, data).then(r => r.data),
  delete: (id) => client.delete(`/family/${id}`),
  listIcloudCalendars: () => client.get('/sync/calendars').then(r => r.data),
}
