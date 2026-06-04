import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

const CATEGORIES = ['Chicken', 'Beef', 'Pork', 'Seafood', 'Pasta', 'Vegetarian', 'Soup & Stew', 'Salad', 'Pizza', 'Tacos & Mexican', 'Asian', 'Breakfast', 'Other']

const EMPTY = { name: '', category: 'Other', description: '', prep_time: '', url: '', notes: '' }

export default function SavedMealModal({ meal, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    setForm(meal ? {
      name:        meal.name        ?? '',
      category:    meal.category    ?? 'Other',
      description: meal.description ?? '',
      prep_time:   meal.prep_time   ?? '',
      url:         meal.url         ?? '',
      notes:       meal.notes       ?? '',
    } : EMPTY)
  }, [meal])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.name.trim()) return
    onSave({
      name:        form.name.trim(),
      category:    form.category,
      description: form.description || null,
      prep_time:   form.prep_time !== '' ? Number(form.prep_time) : null,
      url:         form.url || null,
      notes:       form.notes || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">{meal ? 'Edit Meal' : 'New Saved Meal'}</h2>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto max-h-[65vh]">
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Name *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Chicken Alfredo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Prep time (min)</label>
              <input
                type="number" min="0" step="5"
                value={form.prep_time}
                onChange={e => set('prep_time', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Short description of the dish" />
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Recipe URL</label>
            <input value={form.url} onChange={e => set('url', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="https://..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Tips, substitutions, family notes…" />
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-warm-200">
          <div>
            {meal && onDelete && (
              <button onClick={() => onDelete(meal.id)} className="text-sm text-red-500 hover:text-red-700 transition-colors">Delete</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700 transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={!form.name.trim()}
              className="px-4 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-600 disabled:opacity-40 transition-colors">
              {meal ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
