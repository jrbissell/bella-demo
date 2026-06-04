import { useState, useEffect } from 'react'
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline'
import RecurrencePicker from '../calendar/RecurrencePicker'

const PRIORITY_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 1, label: 'High' },
  { value: 5, label: 'Medium' },
  { value: 9, label: 'Low' },
]

// Dad's family_member_id — Honey-Do chores can only be assigned to Dad
const DAD_ID = 1

function buildInitialForm(chore) {
  if (chore) {
    return {
      title: chore.title || '',
      notes: chore.notes || '',
      due_date: chore.due_date ? chore.due_date.slice(0, 16) : '',
      priority: chore.priority ?? 0,
      recurrence_rule: chore.recurrence_rule || null,
      family_member_id: chore.family_member_id,
      chore_type: chore.chore_type || null,
    }
  }
  return {
    title: '',
    notes: '',
    due_date: '',
    priority: 0,
    recurrence_rule: null,
    family_member_id: null,
    chore_type: null,
  }
}

export default function ChoreModal({ chore, members, defaultMemberId, onSave, onDelete, onClose }) {
  const isEdit = Boolean(chore?.id)
  const isRecurring = Boolean(chore?.recurrence_rule)
  const [form, setForm] = useState(() => {
    const f = buildInitialForm(chore)
    if (!f.family_member_id && defaultMemberId) f.family_member_id = defaultMemberId
    return f
  })
  const [scopeStep, setScopeStep] = useState(false)

  useEffect(() => {
    const f = buildInitialForm(chore)
    if (!f.family_member_id && defaultMemberId) f.family_member_id = defaultMemberId
    setForm(f)
    setScopeStep(false)
  }, [chore, defaultMemberId])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const setVal = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const buildPayload = () => ({
    title: form.title.trim(),
    notes: form.notes.trim() || null,
    due_date: form.due_date || null,
    priority: Number(form.priority),
    recurrence_rule: form.recurrence_rule || null,
    family_member_id: form.family_member_id,
    chore_type: form.family_member_id === DAD_ID ? (form.chore_type || null) : null,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (isEdit && isRecurring) {
      setScopeStep(true)
      return
    }
    onSave(buildPayload(), null)
  }

  const handleScope = (scope) => {
    onSave(buildPayload(), scope)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">
            {isEdit ? 'Edit Chore' : 'New Chore'}
          </h2>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Clean bathroom"
              required
              autoFocus
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
            />
          </div>

          {/* Assigned to */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Assigned to</label>
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setVal('family_member_id', m.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors"
                  style={{
                    borderColor: form.family_member_id === m.id ? m.color : '#e5e7eb',
                    backgroundColor: form.family_member_id === m.id ? m.color : 'white',
                    color: form.family_member_id === m.id ? 'white' : '#374151',
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Honey-Do toggle — only for Dad */}
          {form.family_member_id === DAD_ID && (
            <div>
              <button
                type="button"
                onClick={() => setVal('chore_type', form.chore_type === 'honey_do' ? null : 'honey_do')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                  form.chore_type === 'honey_do'
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-warm-200 text-warm-400 hover:border-amber-300'
                }`}
              >
                <span className="text-lg">🍯</span>
                Honey-Do
              </button>
            </div>
          )}

          {/* Due date */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Due date</label>
            <input
              type="datetime-local"
              value={form.due_date}
              onChange={set('due_date')}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
            />
          </div>

          {/* Repeat */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Repeat</label>
            <RecurrencePicker
              value={form.recurrence_rule}
              onChange={val => setVal('recurrence_rule', val)}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Priority</label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setVal('priority', p.value)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.priority === p.value
                      ? 'bg-warm-500 text-white border-warm-500'
                      : 'bg-white text-warm-400 border-warm-200 hover:border-warm-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={2}
              placeholder="Optional notes…"
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent resize-none"
            />
          </div>

          {scopeStep ? (
            <div className="pt-2 space-y-2">
              <p className="text-sm text-warm-400 text-center">Edit just this task, or all future repeats?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScopeStep(false)}
                  className="px-3 py-2 text-sm font-medium text-warm-400 bg-warm-100 rounded-lg hover:bg-warm-200 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => handleScope('this')}
                  className="flex-1 px-4 py-2 text-sm font-medium text-warm-600 bg-warm-50 border border-warm-200 rounded-lg hover:bg-warm-50 transition-colors"
                >
                  This task
                </button>
                <button
                  type="button"
                  onClick={() => handleScope('all')}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-warm-500 rounded-lg hover:bg-warm-600 transition-colors"
                >
                  All future
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 pt-2">
              {isEdit && (
                <button
                  type="button"
                  onClick={() => onDelete(chore.id)}
                  className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-warm-700 bg-warm-100 rounded-lg hover:bg-warm-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!form.title.trim() || !form.family_member_id}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-warm-500 rounded-lg hover:bg-warm-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEdit ? 'Save' : 'Add Chore'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
