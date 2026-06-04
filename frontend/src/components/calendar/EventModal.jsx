import { useState } from 'react'
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import RecurrencePicker from './RecurrencePicker'

function toInputDatetime(dt) {
  if (!dt) return ''
  const d = dt instanceof Date ? dt : new Date(dt)
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

// Parse a UTC API string (no Z suffix) as UTC, then format in local time for datetime-local inputs.
function apiToLocalInput(apiStr) {
  if (!apiStr) return ''
  const utc = typeof apiStr === 'string' && !apiStr.endsWith('Z') ? apiStr + 'Z' : apiStr
  return format(new Date(utc), "yyyy-MM-dd'T'HH:mm")
}

function toInputDate(dt) {
  if (!dt) return ''
  const d = dt instanceof Date ? dt : new Date(dt)
  return format(d, 'yyyy-MM-dd')
}

// iCal stores all-day DTEND as exclusive (next day). Subtract 1 for inclusive display.
function allDayEndToDisplay(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr.slice(0, 10) + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  return format(d, 'yyyy-MM-dd')
}

function buildInitialForm(event, initialDate, defaultMemberId) {
  if (event) {
    return {
      title: event.title || '',
      family_member_id: event.family_member_id ?? defaultMemberId,
      all_day: event.all_day || false,
      start_time: event.all_day ? (event.start_time || '').slice(0, 10) : apiToLocalInput(event.start_time),
      end_time: event.all_day ? allDayEndToDisplay(event.end_time || '') : apiToLocalInput(event.end_time),
      location: event.location || '',
      description: event.description || '',
      recurrence_rule: event.recurrence_rule || null,
    }
  }
  // Date-only strings (from FullCalendar dateStr) parse as UTC midnight in JS,
  // shifting to the prior evening in local tz. Force local by appending T00:00:00.
  const start = initialDate
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate + 'T00:00:00' : initialDate)
    : new Date()
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return {
    title: '',
    family_member_id: defaultMemberId,
    all_day: false,
    start_time: toInputDatetime(start),
    end_time: toInputDatetime(end),
    location: '',
    description: '',
    recurrence_rule: null,
  }
}

export default function EventModal({ event, members, initialDate, onSave, onDelete, onClose }) {
  const isEdit = Boolean(event?.id)
  const isRecurring = Boolean(event?.recurrence_rule)
  const defaultMemberId = members[0]?.id ?? ''

  const [form, setForm] = useState(() => buildInitialForm(event, initialDate, defaultMemberId))
  const [scopeStep, setScopeStep] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const setChecked = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.checked }))

  const buildPayload = () => {
    let start_time, end_time
    if (form.all_day) {
      start_time = new Date(form.start_time.slice(0, 10) + 'T00:00:00').toISOString()
      const endD = new Date(form.end_time.slice(0, 10) + 'T00:00:00')
      endD.setDate(endD.getDate() + 1)
      end_time = endD.toISOString()
    } else {
      start_time = new Date(form.start_time).toISOString()
      end_time = new Date(form.end_time).toISOString()
    }
    return {
      ...form,
      family_member_id: Number(form.family_member_id),
      start_time,
      end_time,
      recurrence_rule: form.recurrence_rule || null,
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.family_member_id) return
    if (isEdit && isRecurring) {
      setScopeStep(true)
      return
    }
    onSave(buildPayload(), null)
  }

  const handleScope = (scope) => {
    onSave(buildPayload(), scope)
  }

  const memberColor = members.find(m => m.id === Number(form.family_member_id))?.color ?? '#6366F1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header accent bar */}
        <div className="h-1.5 w-full" style={{ backgroundColor: memberColor }} />

        <div className="flex items-center justify-between px-6 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">
            {isEdit ? 'Edit Event' : 'New Event'}
          </h2>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {/* Title */}
          <input
            type="text"
            value={form.title}
            onChange={set('title')}
            placeholder="Event title"
            required
            autoFocus
            className="w-full text-lg font-medium border-0 border-b border-warm-200 pb-2 focus:outline-none focus:border-warm-500 placeholder-warm-300"
          />

          {/* Family member */}
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1 uppercase tracking-wide">Who</label>
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, family_member_id: m.id }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all"
                  style={{
                    borderColor: Number(form.family_member_id) === m.id ? m.color : 'transparent',
                    backgroundColor: Number(form.family_member_id) === m.id ? m.color + '1a' : '#f3f4f6',
                    color: Number(form.family_member_id) === m.id ? m.color : '#6b7280',
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* All-day toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setForm(f => ({ ...f, all_day: !f.all_day }))}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${form.all_day ? 'bg-warm-500' : 'bg-warm-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.all_day ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm text-warm-400">All day</span>
          </label>

          {/* Date/time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Start</label>
              <input
                type={form.all_day ? 'date' : 'datetime-local'}
                value={form.all_day ? form.start_time.slice(0, 10) : form.start_time.slice(0, 16)}
                onChange={set('start_time')}
                required
                className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">End</label>
              <input
                type={form.all_day ? 'date' : 'datetime-local'}
                value={form.all_day ? form.end_time.slice(0, 10) : form.end_time.slice(0, 16)}
                onChange={set('end_time')}
                required
                className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Recurrence */}
          <RecurrencePicker
            value={form.recurrence_rule}
            onChange={(rrule) => setForm(f => ({ ...f, recurrence_rule: rrule }))}
          />

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={set('location')}
              placeholder="Add a location"
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Notes</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              placeholder="Add notes"
              rows={2}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          {scopeStep ? (
            <div className="pt-1 space-y-2">
              <p className="text-sm text-warm-400 text-center">Edit just this event, or all future repeats?</p>
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
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
                  style={{ color: memberColor, backgroundColor: memberColor + '18', borderColor: memberColor + '44' }}
                >
                  This event
                </button>
                <button
                  type="button"
                  onClick={() => handleScope('all')}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                  style={{ backgroundColor: memberColor }}
                >
                  All future
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 pt-1">
              {isEdit && (
                <button
                  type="button"
                  onClick={() => onDelete(event.id)}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                  Delete
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-warm-700 bg-warm-100 rounded-lg hover:bg-warm-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                  style={{ backgroundColor: memberColor }}
                >
                  {isEdit ? 'Save' : 'Add Event'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
