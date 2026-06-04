import client from './client'

export const getTrackerItems = () => client.get('/tracker/').then(r => r.data)
export const createTrackerItem = (data) => client.post('/tracker/', data).then(r => r.data)
export const updateTrackerItem = (id, data) => client.patch(`/tracker/${id}`, data).then(r => r.data)
export const deleteTrackerItem = (id) => client.delete(`/tracker/${id}`)
