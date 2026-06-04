import client from './client'

const get  = (url)        => client.get(url).then(r => r.data)
const post = (url, body)  => client.post(url, body).then(r => r.data)
const patch = (url, body) => client.patch(url, body).then(r => r.data)
const del  = (url)        => client.delete(url).then(r => r.data)

export const shoppingApi = {
  // stores
  listStores:      ()           => get('/shopping/stores'),
  createStore:     (data)       => post('/shopping/stores', data),
  updateStore:     (id, data)   => patch(`/shopping/stores/${id}`, data),
  deleteStore:     (id)         => del(`/shopping/stores/${id}`),

  // departments
  listDepts:       ()           => get('/shopping/departments'),
  createDept:      (data)       => post('/shopping/departments', data),
  updateDept:      (id, data)   => patch(`/shopping/departments/${id}`, data),
  deleteDept:      (id)         => del(`/shopping/departments/${id}`),

  // items
  listItems:       ()           => get('/shopping/items'),
  createItem:      (data)       => post('/shopping/items', data),
  updateItem:      (id, data)   => patch(`/shopping/items/${id}`, data),
  deleteItem:      (id)         => del(`/shopping/items/${id}`),
  deleteCompleted: ()           => del('/shopping/items/completed/all'),
  archiveItem:     (id)         => post(`/shopping/items/${id}/archive`, {}),

  // staples
  listStaples:     ()           => get('/shopping/staples'),
  createStaple:    (data)       => post('/shopping/staples', data),
  updateStaple:    (id, data)   => patch(`/shopping/staples/${id}`, data),
  deleteStaple:    (id)         => del(`/shopping/staples/${id}`),
  addToList:       (id)         => post(`/shopping/staples/${id}/add-to-list`, {}),
}
