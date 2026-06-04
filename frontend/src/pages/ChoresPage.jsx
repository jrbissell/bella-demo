import { useState, useEffect, useCallback } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { rrulestr } from 'rrule'
import { getChores, createChore, updateChore, deleteChore, splitChore } from '../api/chores'
import { familyApi } from '../api/family'
import { calendarApi } from '../api/calendar'
import ChoreColumn from '../components/chores/ChoreColumn'
import ChoreModal from '../components/chores/ChoreModal'

function getWeekStart(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay()) // back to Sunday
  return d
}

function getWeekEnd(weekStart) {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

function parseDueDate(str) {
  if (!str) return null
  return new Date(str.slice(0, 10) + 'T00:00:00')
}

function choreInView(chore, weekStart, weekEnd, today) {
  if (!chore.due_date) return true
  const due = parseDueDate(chore.due_date)
  if (due >= weekStart && due <= weekEnd) return true
  if (due < weekStart && !chore.completed && due < today) return true  // genuinely past due
  return false
}

// Expand recurring chores into the selected week, similar to calendar events.
// Returns real chore records for the current occurrence, virtual ones for projected occurrences.
function expandChoresToWeek(chores, weekStart, weekEnd, today) {
  const result = []

  for (const chore of chores) {
    const due = chore.due_date ? parseDueDate(chore.due_date) : null

    if (!chore.recurrence_rule) {
      // Non-recurring: existing logic
      if (choreInView(chore, weekStart, weekEnd, today)) result.push(chore)
      continue
    }

    // Due this week → show the real record
    if (due && due >= weekStart && due <= weekEnd) {
      result.push(chore)
      continue
    }

    // Past due and uncompleted → carry-over
    if (due && due < weekStart && due < today && !chore.completed) {
      result.push(chore)
      continue
    }

    // Expand RRULE to find a projected occurrence in this week
    if (!chore.due_date) continue
    const dtstart = `DTSTART:${chore.due_date.slice(0, 10).replace(/-/g, '')}T000000`
    const rruleStr = `${dtstart}\nRRULE:${chore.recurrence_rule}`

    try {
      const rule = rrulestr(rruleStr, { forceset: true })
      const occs = rule.between(weekStart, weekEnd, true)
      if (occs.length > 0) {
        const occDateStr = occs[0].toISOString().slice(0, 10) + 'T00:00:00'
        result.push({ ...chore, due_date: occDateStr, _virtual: true })
      }
    } catch { /* skip */ }
  }

  return result
}

// Expand all events (including recurring) to occurrences that fall within the week.
// Returns copies of each event with start_time set to the specific occurrence.
function expandEventsToWeek(allEvents, weekStart, weekEnd) {
  const results = []

  for (const ev of allEvents) {
    if (!ev.recurrence_rule) {
      const d = new Date(ev.start_time.slice(0, 10) + 'T00:00:00')
      if (d >= weekStart && d <= weekEnd) results.push(ev)
      continue
    }

    // Build rrule string the same way CalendarPage does for FullCalendar
    const rruleLines = ev.recurrence_rule.split('\n')
    const rrulePart  = rruleLines[0]
    const extraLines = rruleLines.slice(1)
    const rawStart   = ev.start_time.split('.')[0]
    const dtstart    = ev.all_day
      ? `DTSTART:${rawStart.replace(/[-:]/g, '')}`          // floating (no Z) for all-day
      : `DTSTART:${rawStart.replace(/[-:]/g, '')}Z`         // UTC for timed events

    const rruleStr = [dtstart, `RRULE:${rrulePart}`, ...extraLines].join('\n')

    try {
      const rule = rrulestr(rruleStr, { forceset: true })
      const occurrences = rule.between(weekStart, weekEnd, true)

      for (const occ of occurrences) {
        // Build an occurrence start string in the same format as DB stores
        const occStart = ev.all_day
          ? occ.toISOString().slice(0, 10) + 'T00:00:00'
          : occ.toISOString().replace('Z', '')

        // Preserve the original duration for the end_time
        const origMs  = new Date(ev.end_time + 'Z') - new Date(ev.start_time + 'Z')
        const occEnd  = ev.all_day
          ? new Date(occ.getTime() + 86_400_000).toISOString().slice(0, 10) + 'T00:00:00'
          : new Date(occ.getTime() + origMs).toISOString().replace('Z', '')

        results.push({ ...ev, start_time: occStart, end_time: occEnd })
      }
    } catch {
      // Fall back: include if original start is in range
      const d = new Date(ev.start_time.slice(0, 10) + 'T00:00:00')
      if (d >= weekStart && d <= weekEnd) results.push(ev)
    }
  }

  results.sort((a, b) => a.start_time.localeCompare(b.start_time))
  return results
}

function weekLabel(weekStart, weekEnd, isCurrentWeek) {
  if (isCurrentWeek) return 'This Week'
  const fmt = (d) => format(d, 'MMM d')
  if (weekStart.getFullYear() !== new Date().getFullYear()) {
    return `${fmt(weekStart)} – ${fmt(weekEnd)}, ${weekStart.getFullYear()}`
  }
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`
}

export default function ChoresPage() {
  const [members, setMembers] = useState([])
  const [chores, setChores] = useState([])
  const [allCalEvents, setAllCalEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))

  const weekEnd = getWeekEnd(weekStart)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isCurrentWeek = weekStart <= today && today <= weekEnd

  const prevWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  const nextWeek = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
  const goToday  = () => setWeekStart(getWeekStart(new Date()))

  const load = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([familyApi.list(), getChores()])
      setMembers(m)
      setChores(c)
    } catch (err) {
      console.error('Failed to load chores', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Fetch all calendar events once; expand recurring ones per selected week client-side
  useEffect(() => {
    calendarApi.list().then(setAllCalEvents).catch(() => {})
  }, [])

  const weekCalEvents = expandEventsToWeek(allCalEvents, weekStart, weekEnd)

  const handleAdd = (member) => setModal({ defaultMemberId: member.id })
  const handleEdit = (chore) => setModal({ chore })

  const handleSave = async (data, scope) => {
    const savedWeekStart = weekStart
    const savedWeekEnd   = weekEnd
    try {
      if (modal?.chore?.id) {
        if (scope === 'this') {
          await splitChore(modal.chore.id, data)
        } else {
          await updateChore(modal.chore.id, data)
        }
      } else {
        await createChore(data)
      }
      // Re-fetch to guarantee UI matches DB (avoids stale-state and missing-chore issues)
      const refreshed = await getChores()
      setChores(refreshed)
      // If the due date moved the chore outside the current week, navigate there
      if (data.due_date) {
        const newDue = parseDueDate(data.due_date)
        if (newDue && (newDue < savedWeekStart || newDue > savedWeekEnd)) {
          setWeekStart(getWeekStart(newDue))
        }
      }
    } catch (err) {
      console.error('Failed to save chore', err)
    }
    setModal(null)
  }

  const handleToggle = async (chore) => {
    try {
      const updated = await updateChore(chore.id, { completed: !chore.completed })
      setChores(cs => cs.map(c => c.id === updated.id ? updated : c))
    } catch (err) {
      console.error('Failed to toggle chore', err)
    }
  }

  const handleDelete = async (choreId) => {
    try {
      await deleteChore(choreId)
      setChores(cs => cs.filter(c => c.id !== choreId))
    } catch (err) {
      console.error('Failed to delete chore', err)
    }
    setModal(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-warm-300 text-sm">
        Loading chores…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-3 border-b border-warm-200 bg-white shrink-0 flex items-center justify-end gap-4">
        {/* Week selector */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={prevWeek}
            className="p-1.5 rounded-lg text-warm-300 hover:text-warm-700 hover:bg-warm-100 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm font-semibold text-warm-700 hover:bg-warm-100 rounded-lg transition-colors min-w-[10rem] text-center"
          >
            {weekLabel(weekStart, weekEnd, isCurrentWeek)}
          </button>
          <button
            onClick={nextWeek}
            className="p-1.5 rounded-lg text-warm-300 hover:text-warm-700 hover:bg-warm-100 transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {members.length === 0 ? (
          <div className="flex items-center justify-center h-full text-warm-300 text-sm">
            Add family members first to start tracking chores.
          </div>
        ) : (
          <div
            className="grid h-full gap-4"
            style={{ gridTemplateColumns: `repeat(${members.length}, minmax(260px, 1fr))` }}
          >
            {members.map(member => {
              const memberChores = expandChoresToWeek(
                chores.filter(c => c.family_member_id === member.id),
                weekStart, weekEnd, today
              )
              const memberEvents = weekCalEvents.filter(e => e.family_member_id === member.id)
              return (
                <ChoreColumn
                  key={member.id}
                  member={member}
                  chores={memberChores}
                  todaysEvents={memberEvents}
                  onAdd={handleAdd}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                />
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <ChoreModal
          chore={modal.chore}
          members={members}
          defaultMemberId={modal.defaultMemberId}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
