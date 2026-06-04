import { useState, useEffect } from 'react'
import { XMarkIcon, BookmarkIcon } from '@heroicons/react/24/outline'

const EMPTY = { title: '', meal_id: '', notes: '', repeat: false }

const DAY_LABELS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${DAY_LABELS[new Date(y, m-1, d).getDay()]} ${MONTH_LABELS[m-1]} ${d}`
}

export default function PlanMealModal({ dateStr, entry, meals, onSave, onDelete, onSaveMeal, onClose }) {
  const [form, setForm]             = useState(EMPTY)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    setForm(entry ? {
      title:   entry.title           ?? '',
      meal_id: entry.meal_id         ?? '',
      notes:   entry.notes           ?? '',
      repeat:  !!entry.recurrence_rule,
    } : EMPTY)
  }, [entry])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleMealSelect = (e) => {
    const id = e.target.value
    set('meal_id', id)
    if (id) {
      const m = meals.find(m => String(m.id) === id)
      if (m) set('title', m.name)
    }
  }

  const handleSubmit = () => {
    if (!form.title.trim()) return
    onSave({
      title:           form.title.trim(),
      meal_id:         form.meal_id ? Number(form.meal_id) : null,
      date:            dateStr,
      notes:           form.notes || null,
      recurrence_rule: form.repeat ? 'FREQ=WEEKLY' : null,
    })
  }

  const alreadySaved = meals.some(m => m.name.toLowerCase() === form.title.trim().toLowerCase())

  const handleSaveMeal = () => {
    if (!form.title.trim() || alreadySaved) return
    onSaveMeal(form.title.trim())
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <div>
            <h2 className="text-base font-semibold text-warm-700">{entry ? 'Edit Meal' : 'Plan Meal'}</h2>
            <p className="text-xs text-warm-300 mt-0.5">{fmtDate(dateStr)}</p>
          </div>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Saved meal (optional)</label>
            <select value={form.meal_id} onChange={handleMealSelect}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option value="">— Custom / type below —</option>
              {meals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Meal name *</label>
            <div className="flex gap-1.5">
              <input
                value={form.title}
                onChange={e => { set('title', e.target.value); set('meal_id', '') }}
                className="flex-1 min-w-0 text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="e.g. Tacos"
              />
              {form.title.trim() && !alreadySaved && (
                <button type="button" onClick={handleSaveMeal} title="Save to meal library"
                  className="shrink-0 flex items-center gap-1 px-2 py-2 text-xs font-medium text-honey-600 border border-honey-200 rounded-lg hover:bg-honey-50 transition-colors">
                  <BookmarkIcon className="w-3.5 h-3.5" />
                  {savedFlash ? 'Saved!' : 'Save'}
                </button>
              )}
              {alreadySaved && (
                <span className="shrink-0 flex items-center gap-1 px-2 py-2 text-xs text-warm-300">
                  <BookmarkIcon className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. double batch" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.repeat}
              onChange={e => set('repeat', e.target.checked)}
              className="w-4 h-4 rounded accent-warm-500"
            />
            <span className="text-sm text-warm-600">Repeat every week</span>
          </label>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-warm-200">
          <div>
            {entry && onDelete && (
              <button onClick={() => onDelete(entry.id)} className="text-sm text-red-500 hover:text-red-700 transition-colors">Delete</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700 transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={!form.title.trim()}
              className="px-4 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-600 disabled:opacity-40 transition-colors">
              {entry ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
