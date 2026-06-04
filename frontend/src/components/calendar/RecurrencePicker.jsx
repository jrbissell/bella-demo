/**
 * Recurrence picker matching all of iCloud Calendar's repeat options.
 *
 * Renders as a single compact button. Clicking opens a full-screen sheet
 * overlay so the parent modal height never changes.
 *
 * Produces / consumes a standard iCal RRULE string, e.g.:
 *   "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE"
 */
import { useState, useEffect } from 'react'
import { ArrowPathIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline'

const WEEKDAYS = [
  { key: 'SU', label: 'S' }, { key: 'MO', label: 'M' }, { key: 'TU', label: 'T' },
  { key: 'WE', label: 'W' }, { key: 'TH', label: 'T' }, { key: 'FR', label: 'F' },
  { key: 'SA', label: 'S' },
]

const WEEK_POSITIONS = [
  { value: '1', label: 'First' }, { value: '2', label: 'Second' },
  { value: '3', label: 'Third' }, { value: '4', label: 'Fourth' },
  { value: '-1', label: 'Last' },
]

const QUICK_OPTIONS = [
  { label: 'Never',        rrule: null },
  { label: 'Every Day',    rrule: 'FREQ=DAILY' },
  { label: 'Every Week',   rrule: 'FREQ=WEEKLY' },
  { label: 'Every 2 Weeks',rrule: 'FREQ=WEEKLY;INTERVAL=2' },
  { label: 'Every Month',  rrule: 'FREQ=MONTHLY' },
  { label: 'Every Year',   rrule: 'FREQ=YEARLY' },
  { label: 'Custom…',      rrule: 'custom' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

export function parseRRule(rrule) {
  if (!rrule) return defaultCustom()
  const p = {}
  rrule.split(';').forEach(part => {
    const [k, v] = part.split('=')
    if (k && v !== undefined) p[k] = v
  })
  const freq = (p.FREQ || 'DAILY').toLowerCase()
  const interval = parseInt(p.INTERVAL || '1', 10)
  let byweekday = [], weekPos = '1', weekDayKey = 'MO', monthlyBy = 'day'
  if (p.BYDAY) {
    const posMatch = p.BYDAY.match(/^(-?\d+)([A-Z]{2})$/)
    if (posMatch) {
      weekPos = posMatch[1]; weekDayKey = posMatch[2]; monthlyBy = 'weekday'
    } else if (p.BYSETPOS) {
      weekPos = p.BYSETPOS; weekDayKey = p.BYDAY.split(',')[0]; monthlyBy = 'weekday'
    } else {
      byweekday = p.BYDAY.split(',')
    }
  }
  const monthDay = p.BYMONTHDAY ? parseInt(p.BYMONTHDAY, 10) : 1
  let endType = 'never', count = 10, until = ''
  if (p.COUNT) { endType = 'count'; count = parseInt(p.COUNT, 10) }
  if (p.UNTIL) {
    endType = 'until'
    const u = p.UNTIL.replace('Z', '')
    until = `${u.slice(0,4)}-${u.slice(4,6)}-${u.slice(6,8)}`
  }
  return { freq, interval, byweekday, monthlyBy, monthDay, weekPos, weekDayKey, endType, count, until }
}

function defaultCustom() {
  return {
    freq: 'daily', interval: 1, byweekday: [], monthlyBy: 'day',
    monthDay: 1, weekPos: '1', weekDayKey: 'MO',
    endType: 'never', count: 10, until: '',
  }
}

function buildRRule(custom) {
  let r = `FREQ=${custom.freq.toUpperCase()}`
  if (custom.interval > 1) r += `;INTERVAL=${custom.interval}`
  if (custom.freq === 'weekly' && custom.byweekday.length > 0)
    r += `;BYDAY=${custom.byweekday.join(',')}`
  if (custom.freq === 'monthly') {
    if (custom.monthlyBy === 'weekday') r += `;BYDAY=${custom.weekPos}${custom.weekDayKey}`
    else r += `;BYMONTHDAY=${custom.monthDay}`
  }
  if (custom.endType === 'count') r += `;COUNT=${custom.count}`
  if (custom.endType === 'until' && custom.until) {
    r += `;UNTIL=${custom.until.replace(/-/g, '')}T235959Z`
  }
  return r
}

export function describeRRule(rrule) {
  if (!rrule) return 'Never'
  const q = QUICK_OPTIONS.find(o => o.rrule === rrule)
  if (q && q.rrule !== 'custom') return q.label
  const c = parseRRule(rrule)
  const freq = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[c.freq]
  return c.interval === 1 ? `Every ${freq}` : `Every ${c.interval} ${freq}s`
}

// ── RecurrenceSheet — full overlay with all options ───────────────────────────

function RecurrenceSheet({ value, onChange, onClose }) {
  const isCustom = value && !QUICK_OPTIONS.some(o => o.rrule === value)
  const [showCustom, setShowCustom] = useState(isCustom)
  const [custom, setCustom] = useState(() => parseRRule(value))
  const [localValue, setLocalValue] = useState(value)

  const setC = (field) => (e) => {
    setCustom(prev => {
      const next = { ...prev, [field]: e.target ? e.target.value : e }
      const rrule = buildRRule(next)
      setLocalValue(rrule)
      return next
    })
  }

  const toggleDay = (key) => {
    setCustom(prev => {
      const days = prev.byweekday.includes(key)
        ? prev.byweekday.filter(d => d !== key)
        : [...prev.byweekday, key]
      const next = { ...prev, byweekday: days }
      setLocalValue(buildRRule(next))
      return next
    })
  }

  const handleQuick = (rrule) => {
    if (rrule === 'custom') {
      setShowCustom(true)
      setLocalValue(buildRRule(custom))
    } else {
      setShowCustom(false)
      setLocalValue(rrule)
    }
  }

  const quickValue = showCustom
    ? 'custom'
    : (QUICK_OPTIONS.find(o => o.rrule === localValue)?.rrule ?? null)

  const handleDone = () => {
    onChange(localValue)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h3 className="text-base font-semibold text-warm-700">Repeat</h3>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Quick select */}
          <select
            value={quickValue ?? 'null'}
            onChange={e => handleQuick(e.target.value === 'null' ? null : e.target.value)}
            className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500"
          >
            {QUICK_OPTIONS.map(o => (
              <option key={o.label} value={o.rrule ?? 'null'}>{o.label}</option>
            ))}
          </select>

          {/* Custom builder */}
          {showCustom && (
            <div className="bg-warm-100 rounded-xl p-4 space-y-3 border border-warm-200">
              {/* Frequency + interval */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-warm-400 mb-1">Frequency</label>
                  <select value={custom.freq} onChange={setC('freq')}
                    className="w-full border border-warm-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-warm-400 mb-1">Every</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} max={99} value={custom.interval}
                      onChange={setC('interval')}
                      className="w-14 border border-warm-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-warm-500" />
                    <span className="text-sm text-warm-400">
                      {{ daily:'day(s)', weekly:'week(s)', monthly:'month(s)', yearly:'year(s)' }[custom.freq]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weekly day picker */}
              {custom.freq === 'weekly' && (
                <div>
                  <label className="block text-xs text-warm-400 mb-1.5">On these days</label>
                  <div className="flex gap-1.5">
                    {WEEKDAYS.map(d => (
                      <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                        className={`w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                          custom.byweekday.includes(d.key)
                            ? 'bg-warm-500 text-white'
                            : 'bg-white border border-warm-200 text-warm-400 hover:border-warm-500'
                        }`}>{d.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly options */}
              {custom.freq === 'monthly' && (
                <div className="space-y-2">
                  <label className="block text-xs text-warm-400">Repeat on</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="monthlyBy" value="day"
                      checked={custom.monthlyBy === 'day'}
                      onChange={() => { setCustom(p => { const n={...p,monthlyBy:'day'}; setLocalValue(buildRRule(n)); return n }) }}
                      className="accent-warm-500" />
                    <span className="text-sm text-warm-700">Day</span>
                    <input type="number" min={1} max={31} value={custom.monthDay}
                      disabled={custom.monthlyBy !== 'day'} onChange={setC('monthDay')}
                      className="w-14 border border-warm-200 rounded-lg px-2 py-1 text-sm text-center disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-warm-500" />
                    <span className="text-sm text-warm-400">of the month</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer flex-wrap">
                    <input type="radio" name="monthlyBy" value="weekday"
                      checked={custom.monthlyBy === 'weekday'}
                      onChange={() => { setCustom(p => { const n={...p,monthlyBy:'weekday'}; setLocalValue(buildRRule(n)); return n }) }}
                      className="accent-warm-500" />
                    <span className="text-sm text-warm-700">The</span>
                    <select value={custom.weekPos} disabled={custom.monthlyBy !== 'weekday'} onChange={setC('weekPos')}
                      className="border border-warm-200 rounded-lg px-2 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-warm-500">
                      {WEEK_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <select value={custom.weekDayKey} disabled={custom.monthlyBy !== 'weekday'} onChange={setC('weekDayKey')}
                      className="border border-warm-200 rounded-lg px-2 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-warm-500">
                      <option value="SU">Sunday</option><option value="MO">Monday</option>
                      <option value="TU">Tuesday</option><option value="WE">Wednesday</option>
                      <option value="TH">Thursday</option><option value="FR">Friday</option>
                      <option value="SA">Saturday</option>
                    </select>
                  </label>
                </div>
              )}

              {/* End condition */}
              <div className="space-y-1.5">
                <label className="block text-xs text-warm-400">End repeat</label>
                {[
                  { val: 'never', label: 'Never' },
                  { val: 'count', label: 'After' },
                  { val: 'until', label: 'On date' },
                ].map(opt => (
                  <label key={opt.val} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="endType" value={opt.val}
                      checked={custom.endType === opt.val}
                      onChange={() => { setCustom(p => { const n={...p,endType:opt.val}; setLocalValue(buildRRule(n)); return n }) }}
                      className="accent-warm-500" />
                    <span className="text-sm text-warm-700 w-14">{opt.label}</span>
                    {opt.val === 'count' && custom.endType === 'count' && (
                      <div className="flex items-center gap-1.5">
                        <input type="number" min={1} max={999} value={custom.count} onChange={setC('count')}
                          className="w-14 border border-warm-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-warm-500" />
                        <span className="text-sm text-warm-400">times</span>
                      </div>
                    )}
                    {opt.val === 'until' && custom.endType === 'until' && (
                      <input type="date" value={custom.until} onChange={setC('until')}
                        className="border border-warm-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-warm-500" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Done */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={handleDone}
            className="w-full py-2.5 text-sm font-semibold text-white bg-warm-500 rounded-xl hover:bg-warm-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main export — compact trigger button ──────────────────────────────────────

export default function RecurrencePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // close sheet on unmount
    return () => setOpen(false)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-warm-200 rounded-lg text-sm text-warm-700 hover:border-warm-500 transition-colors bg-white"
      >
        <div className="flex items-center gap-2">
          <ArrowPathIcon className="w-4 h-4 text-warm-300 shrink-0" />
          <span>{describeRRule(value)}</span>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-warm-300" />
      </button>

      {open && (
        <RecurrenceSheet
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
