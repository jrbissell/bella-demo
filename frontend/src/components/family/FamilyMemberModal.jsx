import { useState, useEffect } from 'react'
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline'

const PRESET_COLORS = [
  { value: '#6366F1', label: 'Indigo' },
  { value: '#10B981', label: 'Emerald' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EF4444', label: 'Red' },
  { value: '#8B5CF6', label: 'Violet' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#14B8A6', label: 'Teal' },
  { value: '#F97316', label: 'Orange' },
]

export default function FamilyMemberModal({ member, onSave, onDelete, onClose }) {
  const isEdit = Boolean(member?.id)
  const [form, setForm] = useState({
    name: '',
    color: PRESET_COLORS[0].value,
    icloud_calendar_name: '',
  })

  useEffect(() => {
    if (member) {
      setForm({
        name: member.name || '',
        color: member.color || PRESET_COLORS[0].value,
        icloud_calendar_name: member.icloud_calendar_name || '',
      })
    }
  }, [member])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.icloud_calendar_name.trim()) return
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">
            {isEdit ? 'Edit Family Member' : 'Add Family Member'}
          </h2>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Josh"
              required
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">
              iCloud Calendar Name
            </label>
            <input
              type="text"
              value={form.icloud_calendar_name}
              onChange={set('icloud_calendar_name')}
              placeholder="e.g. Josh's Calendar"
              required
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-warm-300">
              Must match the calendar name exactly as it appears in Apple Calendar
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    borderColor: form.color === c.value ? '#1e1b4b' : 'transparent',
                    outline: form.color === c.value ? `2px solid ${c.value}` : 'none',
                    outlineOffset: '2px',
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 bg-warm-100 rounded-lg">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: form.color }}
            >
              {form.name ? form.name[0].toUpperCase() : '?'}
            </div>
            <div>
              <p className="text-sm font-medium text-warm-700">{form.name || 'Member Name'}</p>
              <p className="text-xs text-warm-300">{form.icloud_calendar_name || 'Calendar Name'}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(member)}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                Remove
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
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-warm-500 rounded-lg hover:bg-warm-600 transition-colors"
            >
              {isEdit ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
