import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon, CheckIcon, PencilIcon, TrashIcon, Bars3Icon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { budgetApi } from '../api/budget'

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const EXPENSE_CATEGORIES = ['needs', 'wants']
const CAT_LABELS = { needs: 'Needs', wants: 'Wants' }
const CAT_COLORS = {
  needs:  'text-blue-600 bg-blue-50 border-blue-200',
  wants:  'text-amber-600 bg-amber-50 border-amber-200',
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
}

function fmtMonth(id) {
  const [y, m] = id.split('-')
  return `${MONTH_NAMES[+m - 1]} ${y}`
}

function prevMonth(id) {
  let [y, m] = id.split('-').map(Number)
  if (--m < 1) { m = 12; y-- }
  return `${y}-${String(m).padStart(2, '0')}`
}

function nextMonth(id) {
  let [y, m] = id.split('-').map(Number)
  if (++m > 12) { m = 1; y++ }
  return `${y}-${String(m).padStart(2, '0')}`
}

function todayMonthId() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function lastDayOfMonth(monthId) {
  const [y, m] = monthId.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function ordinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

function payDateLabel(item, monthId) {
  if (item.pay_last_day) {
    const last = lastDayOfMonth(monthId)
    const [, m] = monthId.split('-').map(Number)
    return `${MONTH_SHORT[m - 1]} ${last}`
  }
  if (item.pay_day) return `${item.pay_day}${ordinal(item.pay_day)}`
  return '—'
}

function dueDateLabel(item, monthId) {
  if (item.due_last_day) {
    const last = lastDayOfMonth(monthId)
    const [, m] = monthId.split('-').map(Number)
    return `${MONTH_SHORT[m - 1]} ${last}`
  }
  if (item.due_day) return `${item.due_day}${ordinal(item.due_day)}`
  return '—'
}


// ── Inline Actual Cell ────────────────────────────────────────────────────────

function InlineActual({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  const start = () => {
    setDraft(value != null ? String(value) : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commit = () => {
    const n = parseFloat(draft)
    onSave(isNaN(n) ? 0 : n)
    setEditing(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="0.01"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        className="w-24 text-right text-sm font-mono font-semibold text-sage-700 border border-sage-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
      />
    )
  }

  return (
    <button
      onClick={start}
      title="Click to edit"
      className="font-mono font-semibold text-sage-600 hover:text-sage-800 hover:bg-sage-50 rounded px-1 py-0.5 transition-colors cursor-text"
    >
      {fmt(value)}
    </button>
  )
}


// ── Income Modal ──────────────────────────────────────────────────────────────

function IncomeModal({ item, monthId, usedLetters, onSave, onClose }) {
  const isEdit = !!item?.id
  const nextLetter = LETTERS.find(l => !usedLetters.includes(l)) ?? ''

  const [form, setForm] = useState({
    identifier:     item?.identifier     ?? nextLetter,
    name:           item?.name           ?? '',
    pay_last_day:   item?.pay_last_day   ?? false,
    pay_day:        item?.pay_day        ?? '',
    planned_amount: item?.planned_amount ?? '',
    actual_amount:  item?.actual_amount  ?? '',
    received:       item?.received       ?? false,
    one_time:       item?.one_time       ?? false,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim()) return
    onSave({
      month_id:       monthId,
      identifier:     form.identifier || null,
      name:           form.name.trim(),
      pay_last_day:   form.pay_last_day,
      pay_day:        form.pay_last_day ? null : (form.pay_day ? Number(form.pay_day) : null),
      planned_amount: Number(form.planned_amount) || 0,
      actual_amount:  Number(form.actual_amount)  || 0,
      received:       form.received,
      one_time:       form.one_time,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">{isEdit ? 'Edit Income' : 'Add Income'}</h2>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Check ID (A–Z)</label>
              <select value={form.identifier} onChange={e => set('identifier', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">— None —</option>
                {LETTERS.map(l => (
                  <option key={l} value={l} disabled={usedLetters.includes(l) && l !== item?.identifier}>
                    {l}{usedLetters.includes(l) && l !== item?.identifier ? ' (used)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Received</label>
              <label className="flex items-center gap-2 h-[38px] cursor-pointer">
                <input type="checkbox" checked={form.received} onChange={e => set('received', e.target.checked)}
                  className="w-4 h-4 rounded accent-warm-500" />
                <span className="text-sm text-warm-700">{form.received ? 'Yes' : 'No'}</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} autoFocus
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Josh's Paycheck" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Pay Date</label>
              <select value={form.pay_last_day ? 'last' : 'specific'}
                onChange={e => set('pay_last_day', e.target.value === 'last')}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="specific">Specific day</option>
                <option value="last">Last day of month</option>
              </select>
            </div>
            {!form.pay_last_day && (
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-1">Day (1–31)</label>
                <input type="number" min="1" max="31" value={form.pay_day}
                  onChange={e => set('pay_day', e.target.value)}
                  className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="e.g. 15" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Planned ($)</label>
              <input type="number" min="0" step="0.01" value={form.planned_amount}
                onChange={e => set('planned_amount', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Actual ($)</label>
              <input type="number" min="0" step="0.01" value={form.actual_amount}
                onChange={e => set('actual_amount', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="0.00" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.one_time} onChange={e => set('one_time', e.target.checked)}
              className="w-4 h-4 rounded accent-amber-500" />
            <span className="text-sm text-warm-600">One time</span>
            <span className="text-xs text-warm-300">— will not copy to next month</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-warm-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim()}
            className="px-4 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-600 disabled:opacity-40 transition-colors">
            {isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Income Tab ────────────────────────────────────────────────────────────────

function IncomeTab({ monthId }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(undefined)

  const { data: income = [] } = useQuery({
    queryKey: ['budget-income', monthId],
    queryFn: () => budgetApi.listIncome(monthId),
  })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['budget-income', monthId] })
    qc.invalidateQueries({ queryKey: ['savings-envelopes'] })
  }

  const createMut = useMutation({ mutationFn: budgetApi.createIncome, onSuccess: () => { invalidate(); setModal(undefined) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }) => budgetApi.updateIncome(id, data), onSuccess: () => { invalidate(); setModal(undefined) } })
  const deleteMut = useMutation({ mutationFn: budgetApi.deleteIncome, onSuccess: invalidate })

  const usedLetters = income.map(i => i.identifier).filter(Boolean)
  const totalPlanned = income.reduce((s, i) => s + (i.planned_amount || 0), 0)
  const totalActual  = income.reduce((s, i) => s + (i.actual_amount  || 0), 0)

  const handleSave = (form) => {
    if (modal?.id) updateMut.mutate({ id: modal.id, data: form })
    else createMut.mutate(form)
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-warm-700">Income</h2>
          <p className="text-xs text-warm-400 mt-0.5">Track your paychecks and other income sources</p>
        </div>
        <button onClick={() => setModal(null)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors">
          <PlusIcon className="w-4 h-4" /> Add Income
        </button>
      </div>

      <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
        {income.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-warm-300 gap-2">
            <p className="text-sm">No income entries yet.</p>
            <button onClick={() => setModal(null)} className="text-sm text-sage-500 hover:underline">Add your first paycheck</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-200 bg-warm-100">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide w-12">ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide w-24">Pay Date</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-warm-400 uppercase tracking-wide w-28">Planned</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-warm-400 uppercase tracking-wide w-28">Actual</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide w-20">Rcvd</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {income.map(item => (
                <tr key={item.id} className={`group hover:bg-warm-50 transition-colors ${item.received ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    {item.identifier
                      ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold">{item.identifier}</span>
                      : <span className="text-warm-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-warm-700">
                    <span>{item.name}</span>
                    {item.one_time && <span className="ml-1.5 text-[10px] font-semibold bg-amber-100 text-amber-600 px-1 py-0.5 rounded">1×</span>}
                  </td>
                  <td className="px-4 py-3 text-warm-500 text-xs font-mono">{payDateLabel(item, monthId)}</td>
                  <td className="px-4 py-3 text-right font-mono text-warm-600">{fmt(item.planned_amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <InlineActual value={item.actual_amount} onSave={v => updateMut.mutate({ id: item.id, data: { actual_amount: v } })} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => updateMut.mutate({ id: item.id, data: { received: !item.received } })}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-colors ${
                        item.received ? 'bg-sage-500 border-sage-500 text-white' : 'border-warm-300 hover:border-sage-400'
                      }`}>
                      {item.received && <CheckIcon className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => setModal(item)} className="p-1 text-warm-300 hover:text-warm-500 rounded">
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMut.mutate(item.id)} className="p-1 text-warm-300 hover:text-red-500 rounded">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-warm-200 bg-warm-50">
                <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Total</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-warm-700">{fmt(totalPlanned)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-sage-600">{fmt(totalActual)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {modal !== undefined && (
        <IncomeModal
          item={modal}
          monthId={monthId}
          usedLetters={usedLetters}
          onSave={handleSave}
          onClose={() => setModal(undefined)}
        />
      )}
    </div>
  )
}


// ── Expense Modal ─────────────────────────────────────────────────────────────

function ExpenseModal({ item, monthId, checkIds, onSave, onClose }) {
  const isEdit = !!item?.id

  const [form, setForm] = useState({
    category:          item?.category          ?? 'needs',
    name:              item?.name              ?? '',
    due_last_day:      item?.due_last_day      ?? false,
    due_day:           item?.due_day           ?? '',
    planned_amount:    item?.planned_amount    ?? '',
    actual_amount:     item?.actual_amount     ?? '',
    paid:              item?.paid              ?? false,
    income_identifier: item?.income_identifier ?? '',
    one_time:          item?.one_time          ?? false,
    autopay:           item?.autopay           ?? false,
    payment_url:       item?.payment_url       ?? '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim()) return
    onSave({
      month_id:          monthId,
      category:          form.category,
      name:              form.name.trim(),
      due_last_day:      form.due_last_day,
      due_day:           form.due_last_day ? null : (form.due_day ? Number(form.due_day) : null),
      planned_amount:    Number(form.planned_amount) || 0,
      actual_amount:     Number(form.actual_amount)  || 0,
      paid:              form.paid,
      income_identifier: form.income_identifier || null,
      one_time:          form.one_time,
      autopay:           form.autopay,
      payment_url:       form.payment_url.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">{isEdit ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Category + Paid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{CAT_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Paid</label>
              <label className="flex items-center gap-2 h-[38px] cursor-pointer">
                <input type="checkbox" checked={form.paid} onChange={e => set('paid', e.target.checked)}
                  className="w-4 h-4 rounded accent-warm-500" />
                <span className="text-sm text-warm-700">{form.paid ? 'Yes' : 'No'}</span>
              </label>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} autoFocus
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Mortgage, Netflix, Groceries" />
          </div>

          {/* Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Due Date</label>
              <select value={form.due_last_day ? 'last' : 'specific'}
                onChange={e => set('due_last_day', e.target.value === 'last')}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="specific">Specific day</option>
                <option value="last">Last day of month</option>
              </select>
            </div>
            {!form.due_last_day && (
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-1">Day (1–31)</label>
                <input type="number" min="1" max="31" value={form.due_day}
                  onChange={e => set('due_day', e.target.value)}
                  className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="e.g. 1" />
              </div>
            )}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Planned ($)</label>
              <input type="number" min="0" step="0.01" value={form.planned_amount}
                onChange={e => set('planned_amount', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Actual ($)</label>
              <input type="number" min="0" step="0.01" value={form.actual_amount}
                onChange={e => set('actual_amount', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="0.00" />
            </div>
          </div>

          {/* Check ID */}
          {checkIds.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Paid From (Check ID)</label>
              <select value={form.income_identifier} onChange={e => set('income_identifier', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">— Any / Unassigned —</option>
                {checkIds.map(c => (
                  <option key={c.identifier} value={c.identifier}>{c.identifier} — {c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Payment URL */}
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Pay Online URL <span className="font-normal text-warm-300">optional</span></label>
            <input value={form.payment_url} onChange={e => set('payment_url', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="https://..." />
          </div>

          {/* Flags */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.autopay} onChange={e => set('autopay', e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-500" />
              <span className="text-sm text-warm-600">Autopay</span>
              <span className="text-xs text-warm-300">— paid automatically</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.one_time} onChange={e => set('one_time', e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500" />
              <span className="text-sm text-warm-600">One time</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-warm-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim()}
            className="px-4 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-600 disabled:opacity-40 transition-colors">
            {isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Expenses Tab ──────────────────────────────────────────────────────────────

function ExpensesTab({ monthId }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(undefined)

  const { data: expenses = [] } = useQuery({
    queryKey: ['budget-expenses', monthId],
    queryFn: () => budgetApi.listExpenses(monthId),
  })
  const { data: income = [] } = useQuery({
    queryKey: ['budget-income', monthId],
    queryFn: () => budgetApi.listIncome(monthId),
  })
  const { data: autoConfig = { check_ids: [], nm_envelope_id: null } } = useQuery({
    queryKey: ['auto-savings-config'],
    queryFn: budgetApi.getAutoConfig,
  })
  const { data: autoGoals  = [] } = useQuery({ queryKey: ['auto-savings-goals'],  queryFn: budgetApi.listAutoGoals  })
  const { data: envelopes  = [] } = useQuery({ queryKey: ['savings-envelopes'],    queryFn: budgetApi.listEnvelopes  })

  const checkIds = income.filter(i => i.identifier).map(i => ({ identifier: i.identifier, name: i.name }))

  const invalidate = () => qc.invalidateQueries({ queryKey: ['budget-expenses', monthId] })

  const createMut = useMutation({ mutationFn: budgetApi.createExpense, onSuccess: () => { invalidate(); setModal(undefined) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }) => budgetApi.updateExpense(id, data), onSuccess: () => { invalidate(); setModal(undefined) } })
  const deleteMut = useMutation({ mutationFn: budgetApi.deleteExpense, onSuccess: invalidate })

  const handleSave = (form) => {
    if (modal?.id) updateMut.mutate({ id: modal.id, data: form })
    else createMut.mutate(form)
  }

  const [subTab, setSubTab] = useState('needs')

  const grouped = EXPENSE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = expenses.filter(e => e.category === cat)
    return acc
  }, {})

  const totalPlanned = expenses.reduce((s, e) => s + (e.planned_amount || 0), 0)
  const totalActual  = expenses.reduce((s, e) => s + (e.actual_amount  || 0), 0)

  const SUB_TABS = [
    ...EXPENSE_CATEGORIES.map(cat => ({
      id: cat,
      label: CAT_LABELS[cat],
      planned: grouped[cat].reduce((s, e) => s + (e.planned_amount || 0), 0),
      actual:  grouped[cat].reduce((s, e) => s + (e.actual_amount  || 0), 0),
    })),
    { id: 'auto', label: 'Auto Savings', planned: null, actual: null },
  ]

  const activeRows    = subTab !== 'auto' ? (grouped[subTab] ?? []) : []
  const activePlanned = subTab !== 'auto' ? SUB_TABS.find(t => t.id === subTab)?.planned ?? 0 : 0
  const activeActual  = subTab !== 'auto' ? SUB_TABS.find(t => t.id === subTab)?.actual  ?? 0 : 0

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sub-tab strip */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-warm-200 shrink-0">
        <div className="flex gap-1">
          {SUB_TABS.map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                subTab === t.id
                  ? t.id === 'auto' ? 'bg-indigo-100 text-indigo-700' : 'bg-warm-100 text-warm-700'
                  : 'text-warm-400 hover:text-warm-600 hover:bg-warm-50'
              }`}>
              {t.label}
              {t.planned !== null && (
                <span className="ml-1.5 font-mono text-[10px] opacity-60">{fmt(t.planned)}</span>
              )}
            </button>
          ))}
        </div>
        {subTab !== 'auto' && (
          <button onClick={() => setModal({ category: subTab })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors">
            <PlusIcon className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {subTab === 'auto' ? (
          /* Auto Savings read-only section */
          autoGoals.length > 0 ? (() => {
            const nm2 = nextMonthInfo(monthId)
            const grandAutoTotal = autoGoals.reduce((s, g) =>
              s + (g.amount_type === 'per_friday' ? g.amount * nm2.fridays : g.amount), 0)
            const assignedCount2 = autoConfig.check_ids?.length ?? 0
            const perCheck2 = assignedCount2 > 0 ? grandAutoTotal / assignedCount2 : 0
            return (
              <div className="space-y-3">
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-semibold text-indigo-700">Total for {nextMonthInfo(monthId).label}</span>
                    {assignedCount2 > 0 && (
                      <span className="ml-2 text-xs text-indigo-400">
                        {fmt(perCheck2)}/check × {assignedCount2} ({autoConfig.check_ids.join(', ')})
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-indigo-700">{fmt(grandAutoTotal)}</span>
                </div>
                <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-warm-100 bg-warm-50">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide">Goal</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide w-32">Type</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-warm-400 uppercase tracking-wide w-28">Per Friday / Fixed</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-indigo-400 uppercase tracking-wide w-32">Next Month</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide w-36 pl-4">Envelope</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-100">
                      {autoGoals.map(g => {
                        const nm2 = nextMonthInfo(monthId)
                        const total = g.amount_type === 'per_friday' ? g.amount * nm2.fridays : g.amount
                        const env = envelopes.find(e => e.id === g.envelope_id)
                        return (
                          <tr key={g.id}>
                            <td className="px-4 py-3 font-medium text-warm-700">{g.name}</td>
                            <td className="px-4 py-3 text-xs">
                              {g.amount_type === 'per_friday'
                                ? <span className="text-indigo-500">× Fridays</span>
                                : <span className="text-warm-400">Fixed</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-warm-600">{fmt(g.amount)}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-600">{fmt(total)}</td>
                            <td className="px-4 py-3 pl-4 text-xs text-warm-400">{env?.name ?? <span className="italic text-warm-300">—</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })() : (
            <div className="flex items-center justify-center h-32 text-warm-300 text-sm">No auto savings goals configured.</div>
          )
        ) : (
          /* Expense category section */
          <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
            {/* Totals header */}
            <div className={`flex items-center justify-between px-4 py-2.5 border-b border-warm-200 ${CAT_COLORS[subTab].split(' ').slice(1).join(' ')}`}>
              <span className={`text-xs font-bold uppercase tracking-wider ${CAT_COLORS[subTab].split(' ')[0]}`}>
                {CAT_LABELS[subTab]}
              </span>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-warm-400">Planned: <span className="font-semibold text-warm-600">{fmt(activePlanned)}</span></span>
                <span className="text-warm-400">Actual: <span className={`font-semibold ${activeActual > activePlanned ? 'text-red-600' : 'text-sage-600'}`}>{fmt(activeActual)}</span></span>
              </div>
            </div>

            {activeRows.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-warm-300 text-sm gap-2">
                No {CAT_LABELS[subTab].toLowerCase()} expenses.
                <button onClick={() => setModal({ category: subTab })} className="text-sage-500 hover:underline">Add one</button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-warm-100 bg-warm-50">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide w-20">Due</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide w-12">Check</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-warm-400 uppercase tracking-wide w-28">Planned</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-warm-400 uppercase tracking-wide w-28">Actual</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide w-16">Paid</th>
                    <th className="px-4 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-100">
                  {activeRows.map(item => (
                    <tr key={item.id} className={`group hover:bg-warm-50 transition-colors ${item.paid ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-medium text-warm-700">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{item.name}</span>
                          {item.autopay  && <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded">Auto</span>}
                          {item.one_time && <span className="text-[10px] font-semibold bg-amber-100 text-amber-600 px-1 py-0.5 rounded">1×</span>}
                          {item.payment_url && (
                            <a href={item.payment_url} target="_blank" rel="noopener noreferrer"
                              className="text-sage-500 hover:text-sage-700 transition-colors" title="Pay online">
                              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-warm-500 text-xs font-mono">{dueDateLabel(item, monthId)}</td>
                      <td className="px-4 py-3 text-center">
                        {item.income_identifier
                          ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold">{item.income_identifier}</span>
                          : <span className="text-warm-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-warm-600">{fmt(item.planned_amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <InlineActual value={item.actual_amount} onSave={v => updateMut.mutate({ id: item.id, data: { actual_amount: v } })} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => updateMut.mutate({ id: item.id, data: { paid: !item.paid } })}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-colors ${
                            item.paid ? 'bg-sage-500 border-sage-500 text-white' : 'border-warm-300 hover:border-sage-400'
                          }`}>
                          {item.paid && <CheckIcon className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button onClick={() => setModal(item)} className="p-1 text-warm-300 hover:text-warm-500 rounded">
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteMut.mutate(item.id)} className="p-1 text-warm-300 hover:text-red-500 rounded">
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {modal !== undefined && (
        <ExpenseModal
          item={modal}
          monthId={monthId}
          checkIds={checkIds}
          onSave={handleSave}
          onClose={() => setModal(undefined)}
        />
      )}
    </div>
  )
}


// ── Debt Modal ────────────────────────────────────────────────────────────────

function DebtModal({ item, monthId, checkIds, onSave, onClose }) {
  const isEdit = !!item?.id

  const [form, setForm] = useState({
    name:              item?.name              ?? '',
    due_last_day:      item?.due_last_day      ?? false,
    due_day:           item?.due_day           ?? '',
    minimum_payment:   item?.minimum_payment   ?? '',
    planned_amount:    item?.planned_amount    ?? '',
    actual_amount:     item?.actual_amount     ?? '',
    paid:              item?.paid              ?? false,
    income_identifier: item?.income_identifier ?? '',
    one_time:          item?.one_time          ?? false,
    autopay:           item?.autopay           ?? false,
    payment_url:       item?.payment_url       ?? '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim()) return
    onSave({
      month_id:          monthId,
      name:              form.name.trim(),
      due_last_day:      form.due_last_day,
      due_day:           form.due_last_day ? null : (form.due_day ? Number(form.due_day) : null),
      minimum_payment:   Number(form.minimum_payment) || 0,
      planned_amount:    Number(form.planned_amount)  || 0,
      actual_amount:     Number(form.actual_amount)   || 0,
      paid:              form.paid,
      income_identifier: form.income_identifier || null,
      one_time:          form.one_time,
      autopay:           form.autopay,
      payment_url:       form.payment_url.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">{isEdit ? 'Edit Debt' : 'Add Debt'}</h2>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Name + Paid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-warm-400 mb-1">Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} autoFocus
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="e.g. Car Loan, Credit Card" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Paid</label>
              <label className="flex items-center gap-2 h-[38px] cursor-pointer">
                <input type="checkbox" checked={form.paid} onChange={e => set('paid', e.target.checked)}
                  className="w-4 h-4 rounded accent-warm-500" />
                <span className="text-sm text-warm-700">{form.paid ? 'Yes' : 'No'}</span>
              </label>
            </div>
          </div>

          {/* Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Due Date</label>
              <select value={form.due_last_day ? 'last' : 'specific'}
                onChange={e => set('due_last_day', e.target.value === 'last')}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="specific">Specific day</option>
                <option value="last">Last day of month</option>
              </select>
            </div>
            {!form.due_last_day && (
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-1">Day (1–31)</label>
                <input type="number" min="1" max="31" value={form.due_day}
                  onChange={e => set('due_day', e.target.value)}
                  className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="e.g. 1" />
              </div>
            )}
          </div>

          {/* Minimum + Planned + Actual */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Minimum ($)</label>
              <input type="number" min="0" step="0.01" value={form.minimum_payment}
                onChange={e => set('minimum_payment', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Planned ($)</label>
              <input type="number" min="0" step="0.01" value={form.planned_amount}
                onChange={e => set('planned_amount', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Actual ($)</label>
              <input type="number" min="0" step="0.01" value={form.actual_amount}
                onChange={e => set('actual_amount', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="0.00" />
            </div>
          </div>

          {/* Check ID */}
          {checkIds.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Paid From (Check ID)</label>
              <select value={form.income_identifier} onChange={e => set('income_identifier', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">— Any / Unassigned —</option>
                {checkIds.map(c => (
                  <option key={c.identifier} value={c.identifier}>{c.identifier} — {c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Payment URL */}
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Pay Online URL <span className="font-normal text-warm-300">optional</span></label>
            <input value={form.payment_url} onChange={e => set('payment_url', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="https://..." />
          </div>

          {/* Flags */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.autopay} onChange={e => set('autopay', e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-500" />
              <span className="text-sm text-warm-600">Autopay</span>
              <span className="text-xs text-warm-300">— paid automatically</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.one_time} onChange={e => set('one_time', e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500" />
              <span className="text-sm text-warm-600">One time</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-warm-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim()}
            className="px-4 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-600 disabled:opacity-40 transition-colors">
            {isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Debts Tab ─────────────────────────────────────────────────────────────────

function DebtsTab({ monthId }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(undefined)

  const { data: debts  = [] } = useQuery({ queryKey: ['budget-debts',  monthId], queryFn: () => budgetApi.listDebts(monthId)  })
  const { data: income = [] } = useQuery({ queryKey: ['budget-income', monthId], queryFn: () => budgetApi.listIncome(monthId) })

  const checkIds = income.filter(i => i.identifier).map(i => ({ identifier: i.identifier, name: i.name }))
  const invalidate = () => qc.invalidateQueries({ queryKey: ['budget-debts', monthId] })

  const createMut = useMutation({ mutationFn: budgetApi.createDebt, onSuccess: () => { invalidate(); setModal(undefined) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }) => budgetApi.updateDebt(id, data), onSuccess: () => { invalidate(); setModal(undefined) } })
  const deleteMut = useMutation({ mutationFn: budgetApi.deleteDebt, onSuccess: invalidate })

  const handleSave = (form) => {
    if (modal?.id) updateMut.mutate({ id: modal.id, data: form })
    else createMut.mutate(form)
  }

  const totalMin     = debts.reduce((s, d) => s + (d.minimum_payment || 0), 0)
  const totalPlanned = debts.reduce((s, d) => s + (d.planned_amount  || 0), 0)
  const totalActual  = debts.reduce((s, d) => s + (d.actual_amount   || 0), 0)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-warm-700">Debts</h2>
          <p className="text-xs text-warm-400 mt-0.5">Monthly debt payments — minimum, planned, and actual</p>
        </div>
        <button onClick={() => setModal(null)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors">
          <PlusIcon className="w-4 h-4" /> Add Debt
        </button>
      </div>

      <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
        {debts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-warm-300 gap-2">
            <p className="text-sm">No debt payments tracked yet.</p>
            <button onClick={() => setModal(null)} className="text-sm text-sage-500 hover:underline">Add your first debt</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-200 bg-warm-100">
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide w-12">Check</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide w-20">Due</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-warm-400 uppercase tracking-wide w-24">Minimum</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-warm-400 uppercase tracking-wide w-24">Planned</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-warm-400 uppercase tracking-wide w-28">Actual</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide w-16">Paid</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {debts.map(item => (
                <tr key={item.id} className={`group hover:bg-warm-50 transition-colors ${item.paid ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 text-center">
                    {item.income_identifier
                      ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold">{item.income_identifier}</span>
                      : <span className="text-warm-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-warm-700">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{item.name}</span>
                      {item.autopay  && <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded">Auto</span>}
                      {item.one_time && <span className="text-[10px] font-semibold bg-amber-100 text-amber-600 px-1 py-0.5 rounded">1×</span>}
                      {item.payment_url && (
                        <a href={item.payment_url} target="_blank" rel="noopener noreferrer"
                          className="text-sage-500 hover:text-sage-700 transition-colors" title="Pay online">
                          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-warm-500 text-xs font-mono">{dueDateLabel(item, monthId)}</td>
                  <td className="px-4 py-3 text-right font-mono text-warm-400 text-xs">{fmt(item.minimum_payment)}</td>
                  <td className="px-4 py-3 text-right font-mono text-warm-600">{fmt(item.planned_amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <InlineActual value={item.actual_amount} onSave={v => updateMut.mutate({ id: item.id, data: { actual_amount: v } })} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => updateMut.mutate({ id: item.id, data: { paid: !item.paid } })}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-colors ${
                        item.paid ? 'bg-sage-500 border-sage-500 text-white' : 'border-warm-300 hover:border-sage-400'
                      }`}>
                      {item.paid && <CheckIcon className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => setModal(item)} className="p-1 text-warm-300 hover:text-warm-500 rounded">
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMut.mutate(item.id)} className="p-1 text-warm-300 hover:text-red-500 rounded">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-warm-200 bg-warm-50">
                <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Total</td>
                <td className="px-4 py-3 text-right font-mono text-warm-400 text-xs font-bold">{fmt(totalMin)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-warm-700">{fmt(totalPlanned)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-sage-600">{fmt(totalActual)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {modal !== undefined && (
        <DebtModal
          item={modal}
          monthId={monthId}
          checkIds={checkIds}
          onSave={handleSave}
          onClose={() => setModal(undefined)}
        />
      )}
    </div>
  )
}


// ── Savings Tab ──────────────────────────────────────────────────────────────

function EnvelopeModal({ item, onSave, onClose }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    name:          item?.name          ?? '',
    target_amount: item?.target_amount ?? '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim()) return
    onSave({ name: form.name.trim(), target_amount: Number(form.target_amount) || 0 })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">{isEdit ? 'Edit Envelope' : 'New Envelope'}</h2>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-warm-300 hover:text-warm-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} autoFocus
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Emergency Fund, Vacation" />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Goal Amount ($) <span className="font-normal text-warm-300">optional</span></label>
            <input type="number" min="0" step="0.01" value={form.target_amount}
              onChange={e => set('target_amount', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="0.00" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-warm-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim()}
            className="px-4 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-600 disabled:opacity-40">
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TransactionModal({ envelope, incomeIdentifiers = [], onSave, onClose }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ tx_type: 'in', amount: '', date: today, note: '', income_identifier: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.amount || Number(form.amount) <= 0) return
    onSave({
      envelope_id: envelope.id,
      tx_type: form.tx_type,
      amount: Number(form.amount),
      date: form.date,
      note: form.note.trim() || null,
      income_identifier: form.income_identifier || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">Add Transaction — {envelope.name}</h2>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-warm-300 hover:text-warm-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[['in', 'Deposit'], ['out', 'Withdrawal']].map(([val, lbl]) => (
              <button key={val} onClick={() => set('tx_type', val)}
                className={`py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                  form.tx_type === val
                    ? val === 'in' ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-red-400 bg-red-50 text-red-700'
                    : 'border-warm-200 text-warm-400 hover:border-warm-300'
                }`}>
                {val === 'in' ? '↓ ' : '↑ '}{lbl}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Amount ($) *</label>
              <input type="number" min="0.01" step="0.01" value={form.amount} autoFocus
                onChange={e => set('amount', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          {incomeIdentifiers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Paycheck <span className="font-normal text-warm-300">optional</span></label>
              <select value={form.income_identifier} onChange={e => set('income_identifier', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">— not linked —</option>
                {incomeIdentifiers.map(i => (
                  <option key={i.identifier} value={i.identifier}>{i.identifier} — {i.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Note <span className="font-normal text-warm-300">optional</span></label>
            <input value={form.note} onChange={e => set('note', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Paycheck deposit, Car repair" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-warm-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700">Cancel</button>
          <button onClick={handleSave} disabled={!form.amount || Number(form.amount) <= 0}
            className="px-4 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-600 disabled:opacity-40">
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

function SavingsTab({ monthId }) {
  const qc = useQueryClient()
  const [selectedId, setSelectedId]   = useState(null)
  const [envModal, setEnvModal]       = useState(undefined)
  const [txModal, setTxModal]         = useState(false)
  const [deletingTx, setDeletingTx]   = useState(null)
  const [deletingEnv, setDeletingEnv] = useState(null)
  const [dragSrcId, setDragSrcId]     = useState(null)
  const [dragOverId, setDragOverId]   = useState(null)

  const { data: envelopes = [] } = useQuery({ queryKey: ['savings-envelopes'], queryFn: budgetApi.listEnvelopes })
  const { data: income    = [] } = useQuery({ queryKey: ['budget-income', monthId], queryFn: () => budgetApi.listIncome(monthId) })

  const incomeIdentifiers = income.filter(i => i.identifier).map(i => ({ identifier: i.identifier, name: i.name }))

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['savings-envelopes'] })
    qc.invalidateQueries({ queryKey: ['savings-txs'] })
  }

  const createEnvMut = useMutation({ mutationFn: budgetApi.createEnvelope, onSuccess: (env) => { invalidate(); setEnvModal(undefined); setSelectedId(env.id) } })
  const updateEnvMut = useMutation({ mutationFn: ({ id, data }) => budgetApi.updateEnvelope(id, data), onSuccess: () => { invalidate(); setEnvModal(undefined) } })
  const deleteEnvMut  = useMutation({ mutationFn: budgetApi.deleteEnvelope,  onSuccess: () => { invalidate(); setSelectedId(null); setDeletingEnv(null) } })
  const reorderMut    = useMutation({ mutationFn: budgetApi.reorderEnvelopes, onSuccess: invalidate })

  const handleDrop = (targetId) => {
    if (!dragSrcId || dragSrcId === targetId) return
    const ids = envelopes.map(e => e.id)
    const from = ids.indexOf(dragSrcId)
    const to   = ids.indexOf(targetId)
    ids.splice(from, 1)
    ids.splice(to, 0, dragSrcId)
    reorderMut.mutate(ids)
    setDragSrcId(null)
    setDragOverId(null)
  }
  const addTxMut     = useMutation({ mutationFn: ({ envId, data }) => budgetApi.addTransaction(envId, data), onSuccess: () => { invalidate(); setTxModal(false) } })
  const delTxMut     = useMutation({ mutationFn: budgetApi.deleteTransaction, onSuccess: () => { invalidate(); setDeletingTx(null) } })

  const selected = envelopes.find(e => e.id === selectedId) ?? null
  const totalSaved = envelopes.reduce((s, e) => s + (e.balance || 0), 0)

  const handleEnvSave = (form) => {
    if (envModal?.id) updateEnvMut.mutate({ id: envModal.id, data: form })
    else createEnvMut.mutate(form)
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-warm-700">Savings</h2>
          <p className="text-xs text-warm-400 mt-0.5">
            {envelopes.length} envelope{envelopes.length !== 1 ? 's' : ''} · Total saved: <span className="font-semibold text-sage-600">{fmt(totalSaved)}</span>
          </p>
        </div>
        <button onClick={() => setEnvModal(null)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors">
          <PlusIcon className="w-4 h-4" /> New Envelope
        </button>
      </div>

      {envelopes.length === 0 ? (
        <div className="bg-white rounded-xl border border-warm-200 flex flex-col items-center justify-center py-16 gap-2 text-warm-300">
          <p className="text-sm">No savings envelopes yet.</p>
          <button onClick={() => setEnvModal(null)} className="text-sm text-sage-500 hover:underline">Create your first envelope</button>
        </div>
      ) : (
        <>
          {/* Envelope cards */}
          <div className="grid grid-cols-3 gap-4">
            {envelopes.map(env => {
              const pct = env.target_amount > 0 ? Math.min(100, (env.balance / env.target_amount) * 100) : null
              const isSel = env.id === selectedId
              return (
                <div key={env.id}
                  onClick={() => setSelectedId(isSel ? null : env.id)}
                  draggable
                  onDragStart={e => { setDragSrcId(env.id); e.dataTransfer.effectAllowed = 'move' }}
                  onDragOver={e => { e.preventDefault(); setDragOverId(env.id) }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={e => { e.preventDefault(); handleDrop(env.id) }}
                  onDragEnd={() => { setDragSrcId(null); setDragOverId(null) }}
                  className={`group bg-white rounded-xl border-2 p-4 cursor-pointer transition-all ${
                    dragOverId === env.id && dragSrcId !== env.id
                      ? 'border-indigo-400 shadow-lg scale-[1.02]'
                      : dragSrcId === env.id
                        ? 'opacity-40'
                        : isSel
                          ? 'border-sage-400 shadow-md'
                          : 'border-warm-200 hover:border-warm-300'
                  }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Bars3Icon className="w-3.5 h-3.5 text-warm-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                      <span className="font-semibold text-warm-700 text-sm leading-snug truncate">{env.name}</span>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                      {deletingEnv === env.id ? (
                        <div className="flex items-center gap-1 text-xs">
                          <button onClick={() => deleteEnvMut.mutate(env.id)} className="text-red-500 hover:text-red-700 font-medium">Yes</button>
                          <span className="text-warm-300">/</span>
                          <button onClick={() => setDeletingEnv(null)} className="text-warm-400 hover:text-warm-600">No</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => setEnvModal(env)}
                            className="p-1 text-warm-300 hover:text-warm-500 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeletingEnv(env.id)}
                            className="p-1 text-warm-300 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={`text-2xl font-bold font-mono mt-2 ${env.balance < 0 ? 'text-red-600' : 'text-sage-600'}`}>
                    {fmt(env.balance)}
                  </div>
                  {env.target_amount > 0 ? (
                    <>
                      <div className="text-xs text-warm-400 mt-1">Goal: {fmt(env.target_amount)} · {Math.round(pct)}%</div>
                      <div className="mt-2 h-1.5 bg-warm-100 rounded-full overflow-hidden">
                        <div className="h-full bg-sage-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-warm-300 mt-1">No goal set</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Selected envelope — transactions */}
          {selected && (
            <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200 bg-warm-50">
                <span className="font-semibold text-warm-700 text-sm">{selected.name} — Transactions</span>
                <button onClick={() => setTxModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors">
                  <PlusIcon className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {(!selected.transactions || selected.transactions.length === 0) ? (
                <div className="py-10 text-center text-warm-300 text-sm">No transactions yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-warm-100">
                    {[...selected.transactions].reverse().map(tx => (
                      <tr key={tx.id} className="group hover:bg-warm-50">
                        <td className="px-4 py-2.5 w-8">
                          <span className={`text-base ${tx.tx_type === 'in' ? 'text-sage-500' : 'text-red-400'}`}>
                            {tx.tx_type === 'in' ? '↓' : '↑'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-warm-400 text-xs font-mono w-24">{tx.date}</td>
                        <td className="px-4 py-2.5 text-warm-500">{tx.note || <span className="text-warm-300 italic">—</span>}</td>
                        <td className={`px-4 py-2.5 text-right font-mono font-semibold ${tx.tx_type === 'in' ? 'text-sage-600' : 'text-red-500'}`}>
                          {tx.tx_type === 'in' ? '+' : '-'}{fmt(tx.amount)}
                        </td>
                        <td className="px-4 py-2.5 w-10">
                          {deletingTx === tx.id ? (
                            <div className="flex items-center gap-1 text-xs">
                              <button onClick={() => delTxMut.mutate(tx.id)} className="text-red-500 hover:text-red-700 font-medium">Yes</button>
                              <span className="text-warm-300">/</span>
                              <button onClick={() => setDeletingTx(null)} className="text-warm-400 hover:text-warm-600">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletingTx(tx.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-warm-300 hover:text-red-500 rounded transition-opacity">
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      <AutoSavingsSection envelopes={envelopes} invalidateEnvelopes={invalidate} monthId={monthId} />

      {envModal !== undefined && (
        <EnvelopeModal item={envModal} onSave={handleEnvSave} onClose={() => setEnvModal(undefined)} />
      )}
      {txModal && selected && (
        <TransactionModal
          envelope={selected}
          incomeIdentifiers={incomeIdentifiers}
          onSave={({ envId, ...data }) => addTxMut.mutate({ envId: selected.id, data })}
          onClose={() => setTxModal(false)}
        />
      )}
    </div>
  )
}


// ── Auto Savings ─────────────────────────────────────────────────────────────

function fridaysInMonth(year, month) {
  const days = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= days; d++) {
    if (new Date(year, month - 1, d).getDay() === 5) count++
  }
  return count
}

function nextMonthInfo(monthId) {
  // next month relative to the given budget month (YYYY-MM), not today
  const [y, m] = (monthId || todayMonthId()).split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return { year: ny, month: nm, label: `${MONTH_NAMES[nm - 1]} ${ny}`, fridays: fridaysInMonth(ny, nm) }
}

function AutoGoalModal({ item, envelopes, onSave, onClose }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    name:            item?.name            ?? '',
    amount_type:     item?.amount_type     ?? 'per_friday',
    amount:          item?.amount          ?? '',
    envelope_id:     item?.envelope_id     ?? '',
    deposit_on_rcvd: item?.deposit_on_rcvd ?? false,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim() || !form.amount) return
    onSave({
      name:            form.name.trim(),
      amount_type:     form.amount_type,
      amount:          Number(form.amount) || 0,
      envelope_id:     form.envelope_id ? Number(form.envelope_id) : null,
      deposit_on_rcvd: form.deposit_on_rcvd,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">{isEdit ? 'Edit Goal' : 'Add Auto Savings Goal'}</h2>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-warm-300 hover:text-warm-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} autoFocus
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Groceries, Gasoline, Electric" />
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-400 mb-2">Amount Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[['per_friday', '× Fridays in next month'], ['fixed', 'Fixed monthly total']].map(([val, lbl]) => (
                <button key={val} onClick={() => set('amount_type', val)}
                  className={`py-2 px-3 rounded-lg text-sm border-2 transition-colors text-left ${
                    form.amount_type === val
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-warm-200 text-warm-500 hover:border-warm-300'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">
              {form.amount_type === 'per_friday' ? 'Amount per Friday ($) *' : 'Monthly Total ($) *'}
            </label>
            <input type="number" min="0" step="0.01" value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="0.00" />
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Target Envelope</label>
            <select value={form.envelope_id} onChange={e => set('envelope_id', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option value="">— Not assigned —</option>
              {envelopes.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={form.deposit_on_rcvd}
              onChange={e => set('deposit_on_rcvd', e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500" />
            <span className="text-sm text-warm-700">Deposit directly to envelope when check is received</span>
          </label>
          {form.deposit_on_rcvd && (
            <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
              When a paycheck is marked received, ${form.amount || '0'} will be deposited
              to {envelopes.find(e => e.id === Number(form.envelope_id))?.name || 'the target envelope'}.
              This amount is excluded from the Next Month pool.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-warm-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim() || !form.amount}
            className="px-4 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-600 disabled:opacity-40">
            {isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DistributeModal({ goals, fridays, nextLabel, onConfirm, onClose }) {
  const items = goals.map(g => ({
    ...g,
    total: g.amount_type === 'per_friday' ? g.amount * fridays : g.amount,
  }))
  const grandTotal = items.reduce((s, i) => s + i.total, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">Distribute to Envelopes</h2>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-warm-300 hover:text-warm-400" /></button>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-warm-400 mb-3">Withdrawing from <strong>Next Month</strong> and depositing into each envelope ({nextLabel}, {fridays} Fridays):</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-warm-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="py-2 font-medium text-warm-700">{item.name}</td>
                  <td className="py-2 text-warm-400 text-xs">
                    {item.amount_type === 'per_friday'
                      ? `$${item.amount} × ${fridays} Fri`
                      : 'Fixed'}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-sage-600">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-warm-200">
                <td colSpan={2} className="pt-2 text-xs font-semibold text-warm-400 uppercase">Total</td>
                <td className="pt-2 text-right font-mono font-bold text-warm-700">{fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-warm-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700">Cancel</button>
          <button onClick={() => onConfirm(fridays)}
            className="px-4 py-2 text-sm font-medium bg-sage-500 text-white rounded-lg hover:bg-sage-600">
            Distribute {fmt(grandTotal)}
          </button>
        </div>
      </div>
    </div>
  )
}

function AutoSavingsSection({ envelopes, invalidateEnvelopes, monthId }) {
  const qc = useQueryClient()
  const [goalModal, setGoalModal] = useState(undefined)
  const [showDistribute, setShowDistribute] = useState(false)

  const { data: config = { check_ids: [], nm_envelope_id: null } } = useQuery({
    queryKey: ['auto-savings-config'],
    queryFn: budgetApi.getAutoConfig,
  })
  const { data: goals = [] } = useQuery({
    queryKey: ['auto-savings-goals'],
    queryFn: budgetApi.listAutoGoals,
  })

  const invalidateConfig = () => qc.invalidateQueries({ queryKey: ['auto-savings-config'] })
  const invalidateGoals  = () => qc.invalidateQueries({ queryKey: ['auto-savings-goals'] })

  const saveConfigMut   = useMutation({ mutationFn: budgetApi.saveAutoConfig,   onSuccess: invalidateConfig })
  const setupNmMut      = useMutation({ mutationFn: budgetApi.setupNmEnvelope,  onSuccess: () => { invalidateConfig(); invalidateEnvelopes() } })
  const createGoalMut   = useMutation({ mutationFn: budgetApi.createAutoGoal,   onSuccess: () => { invalidateGoals(); setGoalModal(undefined) } })
  const updateGoalMut   = useMutation({ mutationFn: ({ id, data }) => budgetApi.updateAutoGoal(id, data), onSuccess: () => { invalidateGoals(); setGoalModal(undefined) } })
  const deleteGoalMut   = useMutation({ mutationFn: budgetApi.deleteAutoGoal,   onSuccess: invalidateGoals })
  const distributeMut   = useMutation({
    mutationFn: budgetApi.distribute,
    onSuccess: () => { invalidateEnvelopes(); setShowDistribute(false) },
  })

  const nm = nextMonthInfo(monthId)
  const nmEnv = envelopes.find(e => e.id === config.nm_envelope_id) ?? null

  // Pool goals go to Next Month; direct goals deposit per check on RCVD
  const goalTotals = goals.map(g => ({
    ...g,
    total: g.amount_type === 'per_friday' ? g.amount * nm.fridays : g.amount,
  }))
  const grandTotal    = goalTotals.filter(g => !g.deposit_on_rcvd).reduce((s, g) => s + g.total, 0)
  const checkCount    = config.check_ids?.length ?? 0
  const perCheck      = checkCount > 0 ? grandTotal / checkCount : 0

  const toggleCheck = (letter) => {
    const current = config.check_ids ?? []
    const next = current.includes(letter)
      ? current.filter(c => c !== letter)
      : [...current, letter].sort()
    saveConfigMut.mutate({ ...config, check_ids: next })
  }

  const handleGoalSave = (form) => {
    if (goalModal?.id) updateGoalMut.mutate({ id: goalModal.id, data: form })
    else createGoalMut.mutate(form)
  }

  // Envelopes excluding Next Month for the goal target dropdown
  const assignableEnvelopes = envelopes.filter(e => e.id !== config.nm_envelope_id)

  return (
    <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-100">
        <div>
          <span className="font-semibold text-indigo-700 text-sm">Auto Savings</span>
          <span className="ml-2 text-xs text-indigo-400">Next month: {nm.label} · {nm.fridays} Fridays</span>
        </div>
        <button onClick={() => setGoalModal(null)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
          <PlusIcon className="w-3.5 h-3.5" /> Add Goal
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Assigned Checks */}
        <div>
          <div className="text-xs font-medium text-warm-400 mb-2">Assigned Paychecks <span className="font-normal text-warm-300">(which checks contribute to auto savings)</span></div>
          <div className="flex flex-wrap gap-1.5">
            {LETTERS.map(l => (
              <button key={l} onClick={() => toggleCheck(l)}
                className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                  config.check_ids?.includes(l)
                    ? 'bg-indigo-500 text-white'
                    : 'bg-warm-100 text-warm-400 hover:bg-warm-200'
                }`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Goals table */}
        {goals.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-100">
                <th className="pb-2 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide">Goal</th>
                <th className="pb-2 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide w-32">Type</th>
                <th className="pb-2 text-right text-xs font-semibold text-warm-400 uppercase tracking-wide w-24">Amount</th>
                <th className="pb-2 text-right text-xs font-semibold text-warm-400 uppercase tracking-wide w-28">Next Month</th>
                <th className="pb-2 text-left text-xs font-semibold text-warm-400 uppercase tracking-wide w-32 pl-4">Envelope</th>
                <th className="pb-2 w-14"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {goalTotals.map(g => {
                const env = envelopes.find(e => e.id === g.envelope_id)
                return (
                  <tr key={g.id} className="group">
                    <td className="py-2 font-medium text-warm-700">
                      {g.name}
                      {g.deposit_on_rcvd && (
                        <span className="ml-1.5 text-[10px] font-semibold bg-sage-100 text-sage-600 px-1.5 py-0.5 rounded">↓ on RCVD</span>
                      )}
                    </td>
                    <td className="py-2 text-warm-400 text-xs">
                      {g.deposit_on_rcvd
                        ? <span className="text-sage-500">Per check</span>
                        : g.amount_type === 'per_friday'
                          ? <span className="text-indigo-500">× Fridays</span>
                          : <span className="text-warm-400">Fixed</span>}
                    </td>
                    <td className="py-2 text-right font-mono text-warm-600">{fmt(g.amount)}</td>
                    <td className="py-2 text-right font-mono font-semibold">
                      {g.deposit_on_rcvd
                        ? <span className="text-sage-500">{fmt(g.amount)} / check</span>
                        : <span className="text-indigo-600">{fmt(g.total)}</span>}
                    </td>
                    <td className="py-2 pl-4 text-xs text-warm-400">{env?.name ?? <span className="text-warm-300 italic">—</span>}</td>
                    <td className="py-2">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => setGoalModal(g)} className="p-1 text-warm-300 hover:text-warm-500 rounded">
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteGoalMut.mutate(g.id)} className="p-1 text-warm-300 hover:text-red-500 rounded">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {goals.length === 0 && (
          <p className="text-sm text-warm-300 text-center py-4">No auto savings goals yet. Add one to get started.</p>
        )}

        {/* Summary + Next Month envelope */}
        <div className="border-t border-warm-100 pt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-warm-500">Total for {nm.label}</span>
            <span className="font-mono font-bold text-indigo-600">{fmt(grandTotal)}</span>
          </div>
          {checkCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-warm-500">Per paycheck ({checkCount} checks)</span>
              <span className="font-mono font-semibold text-warm-700">{fmt(perCheck)}</span>
            </div>
          )}

          {/* Next Month envelope */}
          <div className="mt-3 flex items-center justify-between gap-3 bg-warm-50 rounded-lg px-3 py-2.5">
            {nmEnv ? (
              <>
                <div>
                  <div className="text-xs text-warm-400">Next Month envelope balance</div>
                  <div className={`text-lg font-bold font-mono ${nmEnv.balance < 0 ? 'text-red-600' : 'text-sage-600'}`}>{fmt(nmEnv.balance)}</div>
                </div>
                <button
                  onClick={() => setShowDistribute(true)}
                  disabled={nmEnv.balance <= 0 || goals.filter(g => g.envelope_id && !g.deposit_on_rcvd).length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-sage-500 text-white rounded-lg hover:bg-sage-600 disabled:opacity-40 transition-colors whitespace-nowrap">
                  Distribute →
                </button>
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-sm text-warm-400">No "Next Month" envelope set up yet.</span>
                <button onClick={() => setupNmMut.mutate()}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
                  Create It
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {goalModal !== undefined && (
        <AutoGoalModal item={goalModal} envelopes={assignableEnvelopes} onSave={handleGoalSave} onClose={() => setGoalModal(undefined)} />
      )}
      {showDistribute && (
        <DistributeModal
          goals={goals.filter(g => g.envelope_id && !g.deposit_on_rcvd)}
          fridays={nm.fridays}
          nextLabel={nm.label}
          onConfirm={(fridays) => distributeMut.mutate({ fridays })}
          onClose={() => setShowDistribute(false)}
        />
      )}
    </div>
  )
}


// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function StatCard({ label, planned, actual }) {
  const over = actual > planned && planned > 0
  return (
    <div className="bg-white rounded-xl border border-warm-200 p-4 flex flex-col gap-1">
      <span className="text-xs font-semibold text-warm-400 uppercase tracking-wide">{label}</span>
      <div className="flex items-end justify-between mt-1">
        <div>
          <div className="text-xs text-warm-400">Planned</div>
          <div className="text-lg font-bold font-mono text-gray-900">{fmt(planned)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-warm-400">Actual</div>
          <div className={`text-lg font-bold font-mono ${actual < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {fmt(actual)}
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardTab({ monthId }) {
  const { data: income    = [] } = useQuery({ queryKey: ['budget-income',    monthId], queryFn: () => budgetApi.listIncome(monthId)   })
  const { data: expenses  = [] } = useQuery({ queryKey: ['budget-expenses',  monthId], queryFn: () => budgetApi.listExpenses(monthId) })
  const { data: debts     = [] } = useQuery({ queryKey: ['budget-debts',     monthId], queryFn: () => budgetApi.listDebts(monthId)    })
  const { data: envelopes = [] } = useQuery({ queryKey: ['savings-envelopes'],         queryFn: budgetApi.listEnvelopes               })
  const { data: autoConfig = { check_ids: [], nm_envelope_id: null } } = useQuery({ queryKey: ['auto-savings-config'], queryFn: budgetApi.getAutoConfig })
  const { data: autoGoals  = [] } = useQuery({ queryKey: ['auto-savings-goals'],  queryFn: budgetApi.listAutoGoals  })
  const { data: savingsTxs = [] } = useQuery({ queryKey: ['savings-txs', monthId], queryFn: () => budgetApi.listTransactionsByMonth(monthId) })

  const totalSaved = envelopes.reduce((s, e) => s + (e.balance || 0), 0)

  // Stat card actuals: 0 for unreceived income / unpaid expenses (counts up as month progresses)
  const statIncome  = i => i.received  ? (i.actual_amount > 0 ? i.actual_amount : (i.planned_amount || 0)) : 0
  const statExp     = e => e.paid      ? (e.actual_amount > 0 ? e.actual_amount : (e.planned_amount || 0)) : 0
  const statDebt    = d => d.paid      ? (d.actual_amount > 0 ? d.actual_amount : d.planned_amount > 0 ? d.planned_amount : (d.minimum_payment || 0)) : 0
  // Per-paycheck table: planned as fallback (shows full picture regardless of RCVD status)
  const effIncome   = i => i.actual_amount > 0 ? i.actual_amount : (i.planned_amount || 0)
  const effExp      = e => e.actual_amount > 0 ? e.actual_amount : (e.planned_amount || 0)
  const effDebt     = d => d.actual_amount > 0 ? d.actual_amount : d.planned_amount > 0 ? d.planned_amount : (d.minimum_payment || 0)
  // Planned column for debts falls back to minimum when planned is 0
  const effDebtPlan = d => d.planned_amount > 0 ? d.planned_amount : (d.minimum_payment || 0)

  const incomePlanned = income.reduce((s, i) => s + (i.planned_amount || 0), 0)
  const incomeActual  = income.reduce((s, i) => s + statIncome(i), 0)
  const expPlanned    = expenses.reduce((s, e) => s + (e.planned_amount || 0), 0)
  const expActual     = expenses.reduce((s, e) => s + statExp(e), 0)
  const debtPlanned   = debts.reduce((s, d) => s + effDebtPlan(d), 0)
  const debtActual    = debts.reduce((s, d) => s + statDebt(d), 0)

  // Auto savings — pool goals go to Next Month; direct goals deposit on RCVD
  const nm           = nextMonthInfo(monthId)
  const poolGoals    = autoGoals.filter(g => !g.deposit_on_rcvd)
  const directGoals  = autoGoals.filter(g => g.deposit_on_rcvd)
  const poolTotal    = poolGoals.reduce((s, g) => s + (g.amount_type === 'per_friday' ? g.amount * nm.fridays : g.amount), 0)
  const assignedIds  = autoConfig.check_ids ?? []
  const perCheck     = assignedIds.length > 0 ? poolTotal / assignedIds.length : 0
  const directPerChk = directGoals.reduce((s, g) => s + g.amount, 0)
  const receivedIds      = income.filter(i => i.received && i.identifier).map(i => i.identifier)
  const receivedAssigned = receivedIds.filter(id => assignedIds.includes(id))
  const poolOwed     = receivedAssigned.length * perCheck
  const directOwed   = receivedAssigned.length * directPerChk
  // Combined totals for stat card
  const autoTotal    = poolTotal + directPerChk * assignedIds.length
  const autoOwed     = poolOwed  + directOwed

  const netPlanned = incomePlanned - expPlanned - debtPlanned - autoTotal
  const netActual  = incomeActual  - expActual  - debtActual  - autoOwed

  // Per-paycheck breakdown
  const paychecks = income.map(item => {
    const isAutoAssigned = item.identifier && assignedIds.includes(item.identifier)
    const autoAmt    = isAutoAssigned ? perCheck : 0
    const expItems   = expenses.filter(e => e.income_identifier === item.identifier)
    const debtItems  = debts.filter(d => d.income_identifier === item.identifier)
    const expTotal   = expItems.reduce((s, e) => s + effExp(e),   0)
    const debtTotal  = debtItems.reduce((s, d) => s + effDebt(d), 0)
    // in = deposit TO savings (reduces check margin); out = withdrawal FROM savings (adds to check amount)
    const linkedTxs  = savingsTxs.filter(t => t.income_identifier === item.identifier)
    const inAmt      = linkedTxs.filter(t => t.tx_type === 'in').reduce((s, t) => s + t.amount, 0)
    const outAmt     = linkedTxs.filter(t => t.tx_type === 'out').reduce((s, t) => s + t.amount, 0)
    const incomeAmt  = effIncome(item) + outAmt
    const margin     = incomeAmt - autoAmt - expTotal - debtTotal - inAmt
    return { item, isAutoAssigned, autoAmt, expItems, debtItems, expTotal, debtTotal, inAmt, outAmt, incomeAmt, margin }
  })

  // Unassigned expenses/debts
  const incomeIds = income.map(i => i.identifier).filter(Boolean)
  const unassignedExp   = expenses.filter(e => !e.income_identifier || !incomeIds.includes(e.income_identifier))
  const unassignedDebts = debts.filter(d => !d.income_identifier || !incomeIds.includes(d.income_identifier))

  // Alert: unpaid expenses/debts whose check has been received
  const unpaidDueExp   = expenses.filter(e => !e.paid && e.income_identifier && receivedIds.includes(e.income_identifier))
  const unpaidDueDebts = debts.filter(d => !d.paid && d.income_identifier && receivedIds.includes(d.income_identifier))
  const unpaidDue      = [...unpaidDueExp, ...unpaidDueDebts]
  const unpaidDueTotal = unpaidDueExp.reduce((s, e) => s + effExp(e), 0) + unpaidDueDebts.reduce((s, d) => s + effDebt(d), 0)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
      <h2 className="text-lg font-bold text-warm-700">Dashboard — {fmtMonth(monthId)}</h2>

      {/* Row 1: 4 equal stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Income"  planned={incomePlanned} actual={incomeActual} />
        <StatCard label="Expenses"      planned={expPlanned}    actual={expActual} />
        <StatCard label="Debt Payments" planned={debtPlanned}   actual={debtActual} />
        <StatCard label="Auto Savings"  planned={autoTotal}     actual={autoOwed} />
      </div>

      {/* Row 2: Bill Account + Savings Account */}
      <div className="grid grid-cols-2 gap-3">
        {/* Bill Account */}
        <div className={`rounded-xl border p-4 flex flex-col gap-1 ${unpaidDueTotal > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-warm-200'}`}>
          <span className="text-xs font-semibold text-warm-400 uppercase tracking-wide">Bill Account</span>
          <div className={`text-2xl font-bold font-mono mt-1 ${unpaidDueTotal > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {fmt(unpaidDueTotal)}
          </div>
          {unpaidDue.length > 0 ? (
            <div className="text-xs text-amber-500 mt-0.5">
              {unpaidDue.length} unpaid bill{unpaidDue.length !== 1 ? 's' : ''}
            </div>
          ) : (
            <div className="text-xs text-warm-300 mt-0.5">All bills paid ✓</div>
          )}
        </div>

        {/* Savings Account */}
        <div className="bg-white rounded-xl border border-warm-200 p-4 flex flex-col gap-1">
          <span className="text-xs font-semibold text-warm-400 uppercase tracking-wide">Savings Account</span>
          <div className={`text-2xl font-bold font-mono mt-1 ${totalSaved < 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(totalSaved)}</div>
          <div className="text-xs text-warm-400">{envelopes.length} envelope{envelopes.length !== 1 ? 's' : ''}</div>
          {autoOwed > 0 && (() => {
            const nmEnv = envelopes.find(e => e.id === autoConfig.nm_envelope_id)
            const nmBal = nmEnv?.balance ?? 0
            const diff  = nmBal - autoOwed
            return (
              <div className={`text-xs mt-1 ${Math.abs(diff) < 0.01 ? 'text-indigo-400' : diff < 0 ? 'text-red-500' : 'text-indigo-400'}`}>
                Next Month: {fmt(nmBal)} of {fmt(autoOwed)}
                {Math.abs(diff) >= 0.01 && <span className="ml-1 font-semibold">({diff > 0 ? '+' : ''}{fmt(diff)})</span>}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Per-paycheck table */}
      {income.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-warm-500 mb-3">Per Paycheck</h3>
          <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-100 bg-warm-50">
                  <th className="px-3 py-2 text-left   text-xs font-semibold text-warm-400 uppercase tracking-wide w-8"></th>
                  <th className="px-3 py-2 text-left   text-xs font-semibold text-warm-400 uppercase tracking-wide">Name</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide">Date</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide">Amount</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide">Expenses</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide">Debt Payments</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide">Auto Savings</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide">Savings</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-warm-400 uppercase tracking-wide">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {paychecks.map(({ item, isAutoAssigned, autoAmt, expTotal, debtTotal, inAmt, incomeAmt, margin }) => (
                  <tr key={item.id} className={`hover:bg-warm-50 transition-colors ${item.received ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-2.5">
                      {item.identifier
                        ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold">{item.identifier}</span>
                        : <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-warm-100 text-warm-400 text-xs">?</span>}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-warm-700">
                      {item.name}
                      {item.received && <span className="ml-1.5 text-[10px] bg-sage-100 text-sage-600 px-1 py-0.5 rounded font-semibold">✓</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center text-warm-400 text-xs font-mono">{payDateLabel(item, monthId)}</td>
                    <td className="px-3 py-2.5 text-center font-mono font-semibold text-warm-700">{fmt(incomeAmt)}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-warm-600">{fmt(expTotal)}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-warm-600">{fmt(debtTotal)}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-indigo-500">{isAutoAssigned ? fmt(autoAmt) : <span className="text-warm-200">—</span>}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-warm-700">{inAmt > 0 ? fmt(inAmt) : <span className="text-warm-200">—</span>}</td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold">
                      <span className={margin >= 0 ? 'text-sage-600' : 'text-red-500'}>{fmt(margin)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Budget Page ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'income',    label: 'Income' },
  { id: 'expenses',  label: 'Expenses' },
  { id: 'debts',     label: 'Debts' },
  { id: 'savings',   label: 'Savings' },
  { id: 'payoff',    label: 'Debt Payoff', soon: true },
]

export default function BudgetPage() {
  const qc = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(todayMonthId)
  const [tab, setTab] = useState('dashboard')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: months = [] } = useQuery({
    queryKey: ['budget-months'],
    queryFn: budgetApi.listMonths,
  })

  const monthExists = months.some(m => m.id === currentMonth)

  const createMonthMut = useMutation({
    mutationFn: () => budgetApi.createMonth(currentMonth, prevMonth(currentMonth)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-months'] }),
  })

  const deleteMonthMut = useMutation({
    mutationFn: () => budgetApi.deleteMonth(currentMonth),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget-months'] })
      setConfirmDelete(false)
    },
  })

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-warm-100">

      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-warm-200 shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentMonth(prevMonth(currentMonth))}
            className="p-1.5 rounded hover:bg-warm-100 text-warm-400 hover:text-warm-600 transition-colors">
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-warm-700 min-w-[140px] text-center">
            {fmtMonth(currentMonth)}
          </span>
          <button onClick={() => setCurrentMonth(nextMonth(currentMonth))}
            className="p-1.5 rounded hover:bg-warm-100 text-warm-400 hover:text-warm-600 transition-colors">
            <ChevronRightIcon className="w-4 h-4" />
          </button>
          {/* Delete month */}
          {monthExists && (
            <div className="ml-1 flex items-center gap-1">
              {confirmDelete ? (
                <>
                  <span className="text-xs text-warm-400">Delete {fmtMonth(currentMonth)}?</span>
                  <button onClick={() => deleteMonthMut.mutate()}
                    className="text-xs font-medium text-red-500 hover:text-red-700 px-1">Yes</button>
                  <span className="text-warm-300 text-xs">/</span>
                  <button onClick={() => setConfirmDelete(false)}
                    className="text-xs text-warm-400 hover:text-warm-600 px-1">No</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="p-1.5 rounded hover:bg-red-50 text-warm-300 hover:text-red-400 transition-colors">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-0.5 border-l border-warm-200 pl-4">
          {TABS.map(t => (
            <button key={t.id}
              onClick={() => !t.soon && setTab(t.id)}
              disabled={t.soon}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                t.soon
                  ? 'text-warm-300 cursor-not-allowed'
                  : tab === t.id
                    ? 'bg-warm-100 text-warm-600'
                    : 'text-warm-400 hover:text-warm-600 hover:bg-warm-50'
              }`}>
              {t.label}
              {t.soon && <span className="ml-1 text-[10px] bg-warm-100 text-warm-300 px-1 rounded">Soon</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Month not created yet */}
      {!monthExists ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-warm-400">
          <p className="text-sm">No budget for <span className="font-semibold text-warm-600">{fmtMonth(currentMonth)}</span> yet.</p>
          {months.length > 0 && (
            <p className="text-xs text-warm-300">Will copy income, expenses &amp; debts from the previous month.</p>
          )}
          <button onClick={() => createMonthMut.mutate()}
            disabled={createMonthMut.isPending}
            className="mt-1 flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-600 disabled:opacity-40 transition-colors">
            <PlusIcon className="w-4 h-4" /> Create {fmtMonth(currentMonth)} Budget
          </button>
        </div>
      ) : (
        <>
          {tab === 'dashboard' && <DashboardTab monthId={currentMonth} />}
          {tab === 'income'    && <IncomeTab    monthId={currentMonth} />}
          {tab === 'expenses'  && <ExpensesTab  monthId={currentMonth} />}
          {tab === 'debts'     && <DebtsTab     monthId={currentMonth} />}
          {tab === 'savings'   && <SavingsTab monthId={currentMonth} />}
        </>
      )}

    </div>
  )
}
