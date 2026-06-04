import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarApi } from '../api/calendar'
import { familyApi } from '../api/family'
import { fetchWeather, wmo } from '../api/weather'
import CalendarView from '../components/calendar/CalendarView'
import EventModal from '../components/calendar/EventModal'
import FamilyPanel from '../components/family/FamilyPanel'

export default function CalendarPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | { type: 'new', date } | { type: 'edit', event }

  // Fetch family members
  const { data: members = [] } = useQuery({
    queryKey: ['family-members'],
    queryFn: familyApi.list,
  })

  // Track which members' calendars are visible (all visible by default)
  const [visibleMembers, setVisibleMembers] = useState(() => new Set())

  const effectiveVisible = useMemo(() => {
    if (visibleMembers.size === 0) return new Set(members.map(m => m.id))
    return visibleMembers
  }, [visibleMembers, members])

  const toggleMember = (id) => {
    setVisibleMembers(prev => {
      const next = new Set(members.map(m => m.id)) // start from all
      if (prev.size === 0) {
        // currently showing all → hide this one
        next.delete(id)
        return next
      }
      const updated = new Set(prev)
      if (updated.has(id)) {
        updated.delete(id)
        if (updated.size === 0) return new Set() // all hidden → revert to show-all
      } else {
        updated.add(id)
        if (updated.size === members.length) return new Set() // all selected → show-all
      }
      return updated
    })
  }

  // Fetch weather (16-day daily forecast, shared cache key with Header)
  const { data: weatherData } = useQuery({
    queryKey: ['weather'],
    queryFn: fetchWeather,
    staleTime: 30 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
  })

  const weatherByDate = useMemo(() => {
    if (!weatherData?.daily) return {}
    const { time, weather_code, temperature_2m_max, temperature_2m_min } = weatherData.daily
    return Object.fromEntries(
      time.map((date, i) => [date, {
        icon: wmo(weather_code[i]).icon,
        high: Math.round(temperature_2m_max[i]),
        low:  Math.round(temperature_2m_min[i]),
      }])
    )
  }, [weatherData])

  // Fetch events
  const { data: rawEvents = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => calendarApi.list(),
    refetchInterval: 60_000,
  })

  // Map to FullCalendar event format and filter by visible members.
  // Recurring events (those with a recurrence_rule) use FullCalendar's RRULE
  // plugin so all occurrences render from a single DB row.
  const fcEvents = useMemo(() =>
    rawEvents
      .filter(ev => effectiveVisible.has(ev.family_member_id))
      .map(ev => {
        const base = {
          id: String(ev.id),
          title: ev.title,
          backgroundColor: ev.family_member_color ?? '#6366F1',
          borderColor: 'transparent',
          extendedProps: { ...ev },
        }

        if (ev.recurrence_rule) {
          let dtstart, duration

          // recurrence_rule may contain EXDATE lines after the first line
          const rruleLines = ev.recurrence_rule.split('\n')
          const rrulePart  = rruleLines[0]
          const extraLines = rruleLines.slice(1) // EXDATE:... lines if any

          if (ev.all_day) {
            const raw = ev.start_time.split('.')[0].replace(/[-:]/g, '')
            dtstart = `DTSTART:${raw}`
            duration = '24:00:00'
          } else {
            const raw = ev.start_time.split('.')[0]
            dtstart = `DTSTART:${raw.replace(/[-:]/g, '')}Z`
            const ms = new Date(ev.end_time + 'Z') - new Date(ev.start_time + 'Z')
            const h  = Math.floor(ms / 3_600_000)
            const m  = Math.floor((ms % 3_600_000) / 60_000)
            duration = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`
          }

          const rruleStr = [dtstart, `RRULE:${rrulePart}`, ...extraLines].join('\n')

          return {
            ...base,
            rrule: rruleStr,
            duration,
            allDay: ev.all_day,
          }
        }

        const toUtc = (s) => s && !s.endsWith('Z') ? s + 'Z' : s
        return {
          ...base,
          start: ev.all_day ? ev.start_time.slice(0, 10) : toUtc(ev.start_time),
          end:   ev.all_day ? ev.end_time.slice(0, 10)   : toUtc(ev.end_time),
          allDay: ev.all_day,
        }
      }),
    [rawEvents, effectiveVisible]
  )

  // Mutations
  const createMutation = useMutation({
    mutationFn: calendarApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setModal(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => calendarApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setModal(null) },
  })

  const splitMutation = useMutation({
    mutationFn: ({ id, data }) => calendarApi.splitEvent(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setModal(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: calendarApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setModal(null) },
  })

  const handleSave = (form, scope) => {
    if (modal?.type === 'edit') {
      if (scope === 'this') {
        splitMutation.mutate({
          id: modal.event.id,
          data: { ...form, occurrence_date: modal.event.start_time },
        })
      } else {
        updateMutation.mutate({ id: modal.event.id, data: form })
      }
    } else {
      createMutation.mutate(form)
    }
  }

  const handleEventDrop = (fcEvent) => {
    const ev = fcEvent.extendedProps
    updateMutation.mutate({
      id: ev.id,
      data: {
        start_time: fcEvent.start.toISOString(),
        end_time: fcEvent.end ? fcEvent.end.toISOString() : fcEvent.start.toISOString(),
      },
    })
  }

  const openEventModal = (fcEvent) => {
    const ev = fcEvent.extendedProps
    setModal({ type: 'edit', event: {
      ...ev,
      id: Number(fcEvent.id),
      // Use FullCalendar's already-parsed Date objects so the modal reflects the
      // same date/time the calendar displays, not a re-parsed raw UTC string.
      start_time: fcEvent.start.toISOString(),
      end_time: (fcEvent.end ?? fcEvent.start).toISOString(),
    }})
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <FamilyPanel
        visibleMembers={effectiveVisible}
        onToggleMember={toggleMember}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <CalendarView
          events={fcEvents}
          weatherByDate={weatherByDate}
          onDateClick={(date) => setModal({ type: 'new', date })}
          onEventClick={openEventModal}
          onEventDrop={handleEventDrop}
        />
      </div>

      {modal && (
        <EventModal
          event={modal.type === 'edit' ? modal.event : null}
          initialDate={modal.type === 'new' ? modal.date : null}
          members={members}
          onSave={handleSave}
          onDelete={(id) => deleteMutation.mutate(id)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
