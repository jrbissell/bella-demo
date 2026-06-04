import { useState } from 'react'
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { mealsApi } from '../../api/meals'

function MacroBadge({ label, value, unit = 'g', color }) {
  if (value == null) return null
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${color}`}>
      <span className="text-xs font-bold">{Math.round(value)}{unit}</span>
      <span className="text-[10px] opacity-70">{label}</span>
    </div>
  )
}

export default function RecipeImportModal({ onSave, onClose }) {
  const [url, setUrl]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [preview, setPreview] = useState(null)  // parsed recipe data
  const [form, setForm]       = useState(null)   // editable copy

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleFetch = async () => {
    if (!url.trim()) return
    setLoading(true); setError(null); setPreview(null); setForm(null)
    try {
      const data = await mealsApi.importRecipe(url.trim())
      setPreview(data)
      setForm({ ...data })
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not parse recipe from that URL.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!form?.name) return
    const payload = {
      ...form,
      servings:  form.servings  ? Number(form.servings)  : null,
      calories:  form.calories  ? Number(form.calories)  : null,
      protein_g: form.protein_g ? Number(form.protein_g) : null,
      carbs_g:   form.carbs_g   ? Number(form.carbs_g)   : null,
      fat_g:     form.fat_g     ? Number(form.fat_g)     : null,
    }
    onSave(payload)
  }

  const ingredients  = form?.ingredients  ? JSON.parse(form.ingredients)  : []
  const instructions = form?.instructions ? JSON.parse(form.instructions) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200 shrink-0">
          <h2 className="text-base font-semibold text-warm-700">Import Recipe</h2>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        {/* URL bar */}
        <div className="px-5 py-4 border-b border-warm-100 shrink-0">
          <div className="flex gap-2">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFetch()}
              placeholder="https://www.allrecipes.com/recipe/..."
              className="flex-1 text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={handleFetch}
              disabled={loading || !url.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              <ArrowDownTrayIcon className={`w-4 h-4 ${loading ? 'animate-bounce' : ''}`} />
              {loading ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        {/* Preview / edit */}
        {form && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Recipe name</label>
              <input value={form.name ?? ''} onChange={e => setF('name', e.target.value)}
                className="w-full text-sm font-semibold border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            {/* Servings + serving size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-1">Servings</label>
                <input type="number" min="1" value={form.servings ?? ''} onChange={e => setF('servings', e.target.value)}
                  className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-1">Serving size</label>
                <input value={form.serving_size ?? ''} onChange={e => setF('serving_size', e.target.value)}
                  placeholder="e.g. 1 cup" className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>

            {/* Macros */}
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-2">Macros per serving</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'calories',  label: 'Calories', unit: 'kcal', color: 'bg-amber-50 text-amber-700' },
                  { key: 'protein_g', label: 'Protein',  unit: 'g',    color: 'bg-blue-50 text-blue-700' },
                  { key: 'carbs_g',   label: 'Carbs',    unit: 'g',    color: 'bg-green-50 text-green-700' },
                  { key: 'fat_g',     label: 'Fat',      unit: 'g',    color: 'bg-orange-50 text-orange-700' },
                ].map(({ key, label, unit, color }) => (
                  <div key={key} className={`rounded-lg p-2 ${color}`}>
                    <label className="block text-[10px] font-medium opacity-70 mb-1">{label} ({unit})</label>
                    <input
                      type="number" min="0" step="0.1"
                      value={form[key] ?? ''}
                      onChange={e => setF(key, e.target.value)}
                      className="w-full text-sm font-bold bg-transparent border-0 p-0 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Ingredients */}
            {ingredients.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-2">Ingredients ({ingredients.length})</label>
                <ul className="space-y-1 max-h-40 overflow-y-auto text-sm text-warm-700">
                  {ingredients.map((ing, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-warm-300 shrink-0">·</span>
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Instructions */}
            {instructions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-2">Instructions ({instructions.length} steps)</label>
                <ol className="space-y-2 max-h-40 overflow-y-auto text-sm text-warm-700 list-decimal list-inside">
                  {instructions.map((step, i) => (
                    <li key={i} className="leading-snug">{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-warm-200 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700 transition-colors">Cancel</button>
          {form && (
            <button onClick={handleSave} disabled={!form.name?.trim()}
              className="px-4 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-600 disabled:opacity-40 transition-colors">
              Save Recipe
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
