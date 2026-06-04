import { useRef, useState, useEffect, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import rrulePlugin from '@fullcalendar/rrule'

function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function CalendarView({ events, weatherByDate = {}, onDateClick, onEventClick, onEventDrop }) {
  const calRef       = useRef(null)
  const containerRef = useRef(null)
  const [calHeight, setCalHeight] = useState('100%')
  const [viewKey, setViewKey]     = useState(0)

  const equalizeRows = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      const tbody = container.querySelector('.fc-daygrid-body tbody')
      if (!tbody) return
      const trs = Array.from(tbody.querySelectorAll('tr'))
      if (!trs.length) return
      const rowH = Math.floor(tbody.getBoundingClientRect().height / trs.length)
      trs.forEach(tr => { tr.style.height = `${rowH}px` })
    }))
  }, [])

  // Inject weather spans into month-view day cells via DOM.
  // fc-daygrid-day-top uses flex-direction:row-reverse, so appending a span
  // after the day-number anchor makes it appear on the LEFT visually.
  useEffect(() => {
    if (!containerRef.current) return
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const dayEls = containerRef.current?.querySelectorAll('.fc-daygrid-day[data-date]')
      if (!dayEls) return
      dayEls.forEach(dayEl => {
        const dateStr = dayEl.getAttribute('data-date')
        const w       = weatherByDate[dateStr]
        const top     = dayEl.querySelector('.fc-daygrid-day-top')
        if (!top) return
        let wxSpan = top.querySelector('.bella-weather')
        if (!wxSpan) {
          wxSpan = document.createElement('span')
          wxSpan.className = 'bella-weather'
          wxSpan.style.cssText = 'font-size:0.68rem;color:#94a3b8;padding:2px 4px;align-self:center;'
          top.appendChild(wxSpan)
        }
        wxSpan.textContent = w ? `${w.icon} ${w.high}°` : ''
      })
    }))
  }, [weatherByDate, viewKey])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setCalHeight(entry.contentRect.height)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { equalizeRows() }, [calHeight, equalizeRows])

  const handleDatesSet = useCallback(() => {
    equalizeRows()
    setViewKey(k => k + 1)
  }, [equalizeRows])

  const handleDateClick  = useCallback((info) => onDateClick(info.dateStr),   [onDateClick])
  const handleEventClick = useCallback((info) => onEventClick(info.event),    [onEventClick])
  const handleEventDrop  = useCallback((info) => onEventDrop(info.event),     [onEventDrop])

  return (
    <div ref={containerRef} className="flex-1 min-h-0 px-3 pb-3 pt-1 overflow-hidden">
      <FullCalendar
        ref={calRef}
        plugins={[rrulePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        height={calHeight}
        datesSet={handleDatesSet}
        scrollTime="08:00:00"
        events={events}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        dayHeaderContent={(arg) => {
          if (arg.view.type === 'dayGridMonth') return <span>{arg.text}</span>
          const dateStr = toDateStr(arg.date)
          const w = weatherByDate[dateStr]
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span>{arg.text}</span>
              {w && (
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 400 }}>
                  {w.icon} {w.high}°/{w.low}°
                </span>
              )}
            </div>
          )
        }}
        eventDidMount={(info) => {
          if (info.view.type !== 'dayGridMonth') return
          const el = info.el
          el.style.background   = 'transparent'
          el.style.border       = 'none'
          el.style.boxShadow    = 'none'
          el.style.borderRadius = '0'
          el.style.padding      = '0'
          const main = el.querySelector('.fc-event-main')
          if (main) main.style.padding = '0'
        }}
        editable={true}
        selectable={true}
        dayMaxEvents={2}
        expandRows={true}
        showNonCurrentDates={false}
        nowIndicator={true}
        eventDisplay="block"
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
        eventContent={(arg) => {
          const isMonth = arg.view.type === 'dayGridMonth'

          if (isMonth) {
            const color = arg.event.backgroundColor || '#6366f1'
            return (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, overflow: 'hidden', minWidth: 0, padding: '0 2px', color }}>
                {arg.timeText && (
                  <span style={{ fontSize: '0.68rem', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600 }}>
                    {arg.timeText}
                  </span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', fontWeight: 500 }}>
                  {arg.event.title}
                </span>
              </div>
            )
          }

          const durationMs = arg.event.end ? arg.event.end - arg.event.start : 0
          const isShort = durationMs > 0 && durationMs <= 30 * 60 * 1000

          if (isShort) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 2px', overflow: 'hidden', minWidth: 0 }}>
                {arg.timeText && (
                  <span style={{ fontSize: '0.7rem', opacity: 0.88, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {arg.timeText}
                  </span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, fontSize: '0.8125rem' }}>
                  {arg.event.title}
                </span>
              </div>
            )
          }

          return (
            <div style={{ overflow: 'hidden', minWidth: 0, lineHeight: 1.25, height: '100%', padding: '1px 2px' }}>
              {arg.timeText && (
                <span style={{ fontSize: '0.7rem', whiteSpace: 'nowrap', display: 'block', opacity: 0.88 }}>
                  {arg.timeText}
                </span>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', fontWeight: 500, fontSize: '0.8125rem' }}>
                {arg.event.title}
              </span>
            </div>
          )
        }}
      />
    </div>
  )
}
