import { useState } from 'react'
import { PlusIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import ChoreItem from './ChoreItem'

const todayStr = new Date().toDateString()

function getInitials(name) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function eventDayLabel(ev) {
  // All-day events: parse date part only — appending Z shifts midnight UTC to prior evening in local tz
  const dateStr = ev.all_day
    ? ev.start_time.slice(0, 10) + 'T00:00:00'
    : ev.start_time + (ev.start_time.endsWith('Z') ? '' : 'Z')
  const d = new Date(dateStr)
  if (d.toDateString() === todayStr) return 'Today'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatEventTime(ev) {
  if (ev.all_day) return 'All day'
  const d = new Date(ev.start_time + (ev.start_time.endsWith('Z') ? '' : 'Z'))
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', meridiem: 'short' })
}

export default function ChoreColumn({ member, chores, todaysEvents = [], onAdd, onToggle, onEdit }) {
  const [showDone, setShowDone] = useState(true)
  const active = chores.filter(c => !c.completed)
  const done   = chores.filter(c => c.completed)

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-warm-200 shadow-sm min-w-0 w-full">

      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
            style={{ backgroundColor: member.color }}
          >
            {getInitials(member.name)}
          </div>
          <span className="text-sm font-semibold text-warm-700">{member.name}</span>
          {active.length > 0 && (
            <span className="text-xs font-semibold bg-warm-100 text-warm-400 px-1.5 py-0.5 rounded-full">
              {active.length}
            </span>
          )}
        </div>
        <button
          onClick={() => onAdd(member)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-warm-300 hover:text-warm-500 hover:bg-warm-50 transition-colors"
          title={`Add chore for ${member.name}`}
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">

        {/* Week events grouped by day */}
        {todaysEvents.length > 0 && (() => {
          const grouped = []
          const seen = {}
          todaysEvents.forEach(ev => {
            const label = eventDayLabel(ev)
            if (!seen[label]) { seen[label] = true; grouped.push({ label, events: [] }) }
            grouped[grouped.length - 1].events.push(ev)
          })
          return (
            <div className="mb-1">
              {grouped.map(({ label, events }) => (
                <div key={label} className="mb-1.5">
                  <p className="text-xs font-semibold text-warm-300 uppercase tracking-wide mb-1">{label}</p>
                  <div className="space-y-1">
                    {events.map(ev => (
                      <div
                        key={ev.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs"
                        style={{ backgroundColor: (ev.family_member_color ?? member.color) + '18' }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: ev.family_member_color ?? member.color }}
                        />
                        <span className="font-medium text-warm-700 truncate flex-1">{ev.title}</span>
                        <span className="text-warm-300 shrink-0">{formatEventTime(ev)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-t border-warm-200 mt-2 mb-1" />
            </div>
          )
        })()}

        {/* Empty states */}
        {active.length === 0 && done.length === 0 && todaysEvents.length === 0 && (
          <p className="text-xs text-warm-300 text-center py-6">No chores — nice! 🎉</p>
        )}
        {active.length === 0 && done.length === 0 && todaysEvents.length > 0 && (
          <p className="text-xs text-warm-300 text-center py-2">No chores this week</p>
        )}

        {/* Active chores */}
        {active.map(chore => (
          <ChoreItem key={chore.id} chore={chore} onToggle={onToggle} onClick={onEdit} />
        ))}

        {/* Completed */}
        {done.length > 0 && (
          <>
            <button
              onClick={() => setShowDone(s => !s)}
              className="flex items-center gap-1.5 w-full pt-2 pb-1 text-left group"
            >
              {showDone
                ? <ChevronDownIcon className="w-3 h-3 text-warm-300" />
                : <ChevronRightIcon className="w-3 h-3 text-warm-300" />}
              <span className="text-xs font-semibold text-warm-400 group-hover:text-warm-600 transition-colors">
                Completed ({done.length})
              </span>
              {!showDone && <span className="text-xs text-warm-300 ml-1">— tap to uncheck</span>}
            </button>
            {showDone && done.map(chore => (
              <ChoreItem key={chore.id} chore={chore} onToggle={onToggle} onClick={onEdit} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
