import client from './client'

export const getChores = () => client.get('/chores/').then(r => r.data)

export const createChore = (data) => client.post('/chores/', data).then(r => r.data)

export const updateChore = (id, data) => client.patch(`/chores/${id}`, data).then(r => r.data)

export const deleteChore = (id) => client.delete(`/chores/${id}`)

export const splitChore = (id, data) => client.post(`/chores/${id}/split`, data).then(r => r.data)
