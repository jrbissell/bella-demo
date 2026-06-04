import { useState, useEffect } from 'react'
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline'

const TYPES = [
  { value: 'bug',     label: 'Bug' },
  { value: 'feature', label: 'New Feature' },
  { value: 'change',  label: 'Change' },
  { value: 'remove',  label: 'Remove' },
]

const STATUSES = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
]

const PRIORITIES = [
  { value: 0, label: 'None' },
  { value: 1, label: 'High' },
  { value: 5, label: 'Medium' },
  { value: 9, label: 'Low' },
]

function blank() {
  return { item_type: 'bug', title: '', description: '', status: 'open', priority: 0 }
}

export default function TrackerModal({ item, onSave, onDelete, onClose }) {
  const isEdit = Boolean(item?.id)
  const [form, setForm] = useState(() => item ? { ...blank(), ...item } : blank())

  useEffect(() => {
    setForm(item ? { ...blank(), ...item } : blank())
  }, [item])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const setVal = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({
      item_type: form.item_type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: Number(form.priority),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">
            {isEdit ? 'Edit Item' : 'New Tracker Item'}
          </h2>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Type</label>
            <div className="flex gap-2">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setVal('item_type', t.value)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.item_type === t.value
                      ? 'bg-warm-500 text-white border-warm-500'
                      : 'bg-white text-warm-400 border-warm-200 hover:border-warm-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={set('title')}
              placeholder="Brief description…"
              required
              autoFocus
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={3}
              placeholder="Additional details…"
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
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

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Status</label>
            <div className="flex gap-2">
              {STATUSES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setVal('status', s.value)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.status === s.value
                      ? 'bg-warm-500 text-white border-warm-500'
                      : 'bg-white text-warm-400 border-warm-200 hover:border-warm-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            {isEdit && (
              <button
                type="button"
                onClick={() => onDelete(item.id)}
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
              disabled={!form.title.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-warm-500 rounded-lg hover:bg-warm-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEdit ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
