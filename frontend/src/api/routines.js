import client from './client'

const get   = (url, params) => client.get(url, { params }).then(r => r.data)
const post  = (url, body)   => client.post(url, body).then(r => r.data)
const patch = (url, body)   => client.patch(url, body).then(r => r.data)
const del   = (url)         => client.delete(url).then(r => r.data)

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

export function parseDays(schedule) {
  if (!schedule || schedule === 'daily')    return ALL_DAYS
  if (schedule === 'weekdays') return [1, 2, 3, 4, 5]
  if (schedule === 'weekends') return [0, 6]
  const parsed = schedule.split(',').map(Number).filter(n => n >= 0 && n <= 6)
  return parsed.length ? parsed : ALL_DAYS
}

export function serializeDays(days) {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  return sorted.length === 7 ? 'daily' : sorted.join(',')
}

// Returns true if a task item should appear today
export function itemScheduledToday(item) {
  return parseDays(item.schedule).includes(new Date().getDay())
}

// Returns which routine types to show given current hour
export function activeTypes() {
  const h = new Date().getHours()
  return h < 12 ? ['morning', 'daily'] : ['evening', 'daily']
}

export const routinesApi = {
  list:           (date)              => get('/routines/', { date }),
  create:         (data)              => post('/routines/', data),
  update:         (id, data)          => patch(`/routines/${id}`, data),
  delete:         (id)                => del(`/routines/${id}`),
  addItem:        (routineId, title, schedule = 'daily') => post(`/routines/${routineId}/items/`, { title, schedule }),
  reorderItems:   (routineId, ids) => post(`/routines/${routineId}/items/reorder`, ids),
  updateItem:     (id, data)          => patch(`/routines/items/${id}`, data),
  deleteItem:     (id)                => del(`/routines/items/${id}`),
  markComplete:   (routine_item_id, date) => post('/routines/completions/', { routine_item_id, date }),
  unmarkComplete: (completionId)      => del(`/routines/completions/${completionId}`),
}
