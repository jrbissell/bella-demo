import client from './client'

const get   = (url)       => client.get(url).then(r => r.data)
const post  = (url, body) => client.post(url, body).then(r => r.data)
const patch = (url, body) => client.patch(url, body).then(r => r.data)
const del   = (url)       => client.delete(url).then(r => r.data)

export const budgetApi = {
  // months
  listMonths:   ()     => get('/budget/months/'),
  createMonth:  (id, copy_from) => post('/budget/months/', { id, copy_from: copy_from ?? null }),
  deleteMonth:  (id)   => del(`/budget/months/${id}`),

  // income
  listIncome:   (month)    => get(`/budget/income/${month}`),
  createIncome: (data)     => post('/budget/income/', data),
  updateIncome: (id, data) => patch(`/budget/income/${id}`, data),
  deleteIncome: (id)       => del(`/budget/income/${id}`),

  // expenses
  listExpenses:   (month)    => get(`/budget/expenses/${month}`),
  createExpense:  (data)     => post('/budget/expenses/', data),
  updateExpense:  (id, data) => patch(`/budget/expenses/${id}`, data),
  deleteExpense:  (id)       => del(`/budget/expenses/${id}`),

  // debts
  listDebts:   (month)    => get(`/budget/debts/${month}`),
  createDebt:  (data)     => post('/budget/debts/', data),
  updateDebt:  (id, data) => patch(`/budget/debts/${id}`, data),
  deleteDebt:  (id)       => del(`/budget/debts/${id}`),

  // savings envelopes
  listEnvelopes:     ()             => get('/budget/savings/envelopes/'),
  createEnvelope:    (data)         => post('/budget/savings/envelopes/', data),
  updateEnvelope:    (id, data)     => patch(`/budget/savings/envelopes/${id}`, data),
  deleteEnvelope:    (id)           => del(`/budget/savings/envelopes/${id}`),
  addTransaction:         (envId, data)  => post(`/budget/savings/envelopes/${envId}/transactions/`, data),
  deleteTransaction:      (txId)         => del(`/budget/savings/transactions/${txId}`),
  listTransactionsByMonth: (month)       => get(`/budget/savings/transactions/?month_id=${month}`),
  reorderEnvelopes:  (ids)          => post('/budget/savings/envelopes/reorder', { ids }),

  // auto savings
  getAutoConfig:       ()       => get('/budget/auto-savings/config'),
  saveAutoConfig:      (data)   => post('/budget/auto-savings/config', data),
  setupNmEnvelope:     ()       => post('/budget/auto-savings/setup-nm', {}),
  listAutoGoals:       ()       => get('/budget/auto-savings/goals/'),
  createAutoGoal:      (data)   => post('/budget/auto-savings/goals/', data),
  updateAutoGoal:      (id, d)  => patch(`/budget/auto-savings/goals/${id}`, d),
  deleteAutoGoal:      (id)     => del(`/budget/auto-savings/goals/${id}`),
  distribute:          (data)   => post('/budget/auto-savings/distribute', data),
}
