import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RRule } from 'rrule'
import {
  CalendarDaysIcon, ClipboardDocumentListIcon, ShoppingCartIcon, CheckCircleIcon, ClockIcon,
} from '@heroicons/react/24/outline'
import { calendarApi } from '../api/calendar'
import { getChores } from '../api/chores'
import { mealsApi } from '../api/meals'
import { shoppingApi } from '../api/shopping'
import { familyApi } from '../api/family'
import { fetchWeather, wmo } from '../api/weather'
import { routinesApi, activeTypes, itemScheduledToday } from '../api/routines'

// ── helpers ──────────────────────────────────────────────────────────────────


const DAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const SDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONS  = ['January','February','March','April','May','June','July','August','September','October','November','December']

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function getWeekDates(todayStr) {
  const d   = new Date(todayStr + 'T12:00:00')
  const dow = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(mon); nd.setDate(mon.getDate() + i)
    return nd.toISOString().slice(0, 10)
  })
}

function occursOnDate(event, targetStr) {
  const eventStart = event.start_time.slice(0, 10)
  if (!event.recurrence_rule) return eventStart === targetStr
  try {
    const dtstart = new Date(event.start_time.includes('T')
      ? (event.start_time.endsWith('Z') ? event.start_time : event.start_time + 'Z')
      : event.start_time + 'T00:00:00Z')
    const opts    = RRule.parseString(event.recurrence_rule)
    opts.dtstart  = dtstart
    const rule    = new RRule(opts)
    const s = new Date(targetStr + 'T00:00:00Z')
    const e = new Date(targetStr + 'T23:59:59Z')
    return rule.between(s, e, true).length > 0
  } catch { return eventStart === targetStr }
}

function mealOccursOnDate(plan, targetStr) {
  if (!plan.recurrence_rule) return plan.date === targetStr
  try {
    const dtstart = new Date(plan.date + 'T12:00:00Z')
    const opts    = RRule.parseString(plan.recurrence_rule)
    opts.dtstart  = dtstart
    const rule    = new RRule(opts)
    const s = new Date(targetStr + 'T00:00:00Z')
    const e = new Date(targetStr + 'T23:59:59Z')
    return rule.between(s, e, true).length > 0
  } catch { return plan.date === targetStr }
}

function fmtEventTime(event) {
  if (event.all_day) return 'All day'
  const d = new Date(event.start_time.endsWith('Z') ? event.start_time : event.start_time + 'Z')
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' })
}


function getInitials(name) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, action, onAction, children }) {
  return (
    <div className="bg-white rounded-2xl border border-warm-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-warm-100">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-warm-400" />
          <span className="text-sm font-semibold text-warm-600">{title}</span>
        </div>
        {action && (
          <button onClick={onAction} className="text-xs text-sage-500 hover:text-sage-700 font-medium transition-colors">
            {action}
          </button>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function HomePage({ onNavigate }) {
  const today       = new Date().toISOString().slice(0, 10)
  const todayDate   = new Date(today + 'T12:00:00')
  const weekDates   = useMemo(() => getWeekDates(today), [today])

  const { data: weather  } = useQuery({ queryKey: ['weather'], queryFn: fetchWeather, staleTime: 30 * 60 * 1000 })
  const { data: members = [] } = useQuery({ queryKey: ['family-members'], queryFn: familyApi.list })
  const { data: events  = [] } = useQuery({ queryKey: ['calendar-events'], queryFn: () => calendarApi.list() })
  const { data: chores  = [] } = useQuery({ queryKey: ['chores'], queryFn: getChores })
  const { data: mealPlan = [] } = useQuery({ queryKey: ['meal-plan'], queryFn: mealsApi.listPlan })
  const { data: savedMeals = [] } = useQuery({ queryKey: ['saved-meals'], queryFn: mealsApi.listMeals })
  const { data: shopItems = [] } = useQuery({ queryKey: ['shopping-items'], queryFn: shoppingApi.listItems })
  const { data: routines  = [] } = useQuery({ queryKey: ['routines', today], queryFn: () => routinesApi.list(today) })

  const qc = useQueryClient()
  const checkMut   = useMutation({ mutationFn: ({ item_id, date }) => routinesApi.markComplete(item_id, date),   onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }) })
  const uncheckMut = useMutation({ mutationFn: (id) => routinesApi.unmarkComplete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }) })

  const handleRoutineCheck = (item) => {
    if (item.completion_id) uncheckMut.mutate(item.completion_id)
    else checkMut.mutate({ item_id: item.id, date: today })
  }

  // ── derived data ──────────────────────────────────────────────────────────

  const memberMap = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members])

  const todayEvents = useMemo(() =>
    events
      .filter(e => occursOnDate(e, today))
      .sort((a, b) => {
        if (a.all_day && !b.all_day) return -1
        if (!a.all_day && b.all_day) return 1
        return a.start_time.localeCompare(b.start_time)
      }),
    [events, today]
  )

  const memberChores = useMemo(() =>
    members.map(m => {
      const mine     = chores.filter(c => c.family_member_id === m.id && !c.completed)
      const overdue  = mine.filter(c => c.due_date && c.due_date < today).length
      const dueToday = mine.filter(c => c.due_date === today).length
      const upcoming = mine.filter(c => c.due_date && c.due_date > today && weekDates.includes(c.due_date)).length
      const status   = overdue > 0 ? 'overdue' : dueToday > 0 ? 'today' : 'ok'
      return { member: m, overdue, dueToday, upcoming, status }
    }),
    [members, chores, today, weekDates]
  )

  const tonightTitle = useMemo(() => {
    const plan = mealPlan.find(p => mealOccursOnDate(p, today))
    const meal = plan ? savedMeals.find(m => m.id === plan.meal_id) : null
    return plan?.title || meal?.name || null
  }, [mealPlan, savedMeals, today])

  const activeShop = useMemo(() => shopItems.filter(i => !i.completed), [shopItems])

  // forecast strip: today + next 4 days
  const forecastDays = useMemo(() => {
    if (!weather?.daily) return []
    const { time, weather_code, temperature_2m_max, temperature_2m_min } = weather.daily
    return time.slice(0, 5).map((date, i) => ({
      date,
      isToday: date === today,
      label: date === today ? 'Today' : SDAYS[new Date(date + 'T12:00:00').getDay()],
      icon: wmo(weather_code[i]).icon,
      high: Math.round(temperature_2m_max[i]),
      low:  Math.round(temperature_2m_min[i]),
    }))
  }, [weather, today])

  // Routines: filter by time-of-day; filter tasks by today's schedule
  const visibleRoutines = useMemo(() => {
    const types = new Set(activeTypes())
    return routines
      .filter(r => types.has(r.routine_type))
      .map(r => ({ ...r, items: r.items.filter(itemScheduledToday) }))
      .filter(r => r.items.length > 0)
  }, [routines])

  // ── render ────────────────────────────────────────────────────────────────

  const dayName  = DAYS[todayDate.getDay()]
  const monName  = MONS[todayDate.getMonth()]
  const dayNum   = todayDate.getDate()
  const current  = weather?.current

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-warm-100">
      <div className="max-w-6xl mx-auto p-6 space-y-5">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden">
          <div className="px-7 pt-6 pb-5 flex items-start justify-between gap-6">

            {/* Greeting + date */}
            <div>
              <p className="text-sm font-medium text-warm-400">{greeting()}</p>
              <h1 className="text-3xl font-bold text-warm-800 mt-0.5 leading-tight">
                {dayName}, {monName} {dayNum}
              </h1>
              {current && (
                <p className="text-sm text-warm-400 mt-2">
                  {wmo(current.weather_code).icon} {Math.round(current.temperature_2m)}°F
                  <span className="mx-1.5 text-warm-200">·</span>
                  Feels {Math.round(current.apparent_temperature)}°
                  <span className="mx-1.5 text-warm-200">·</span>
                  {current.relative_humidity_2m}% humidity
                </p>
              )}
            </div>

            {/* Tonight's dinner */}
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide">Tonight</p>
              {tonightTitle ? (
                <button onClick={() => onNavigate('meals')}
                  className="mt-1 text-right group">
                  <p className="text-xl font-bold text-warm-700 group-hover:text-sage-600 transition-colors">{tonightTitle}</p>
                  <p className="text-xs text-warm-300 mt-0.5">Tap to view meals →</p>
                </button>
              ) : (
                <button onClick={() => onNavigate('meals')}
                  className="mt-1 text-sm text-warm-300 hover:text-sage-500 transition-colors">
                  Nothing planned — add dinner →
                </button>
              )}
            </div>
          </div>

          {/* Forecast strip */}
          {forecastDays.length > 0 && (
            <div className="border-t border-warm-100 grid grid-cols-5 divide-x divide-warm-100">
              {forecastDays.map(d => (
                <div key={d.date} className={`px-4 py-3 text-center ${d.isToday ? 'bg-warm-50' : ''}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${d.isToday ? 'text-sage-600' : 'text-warm-400'}`}>{d.label}</p>
                  <p className="text-2xl my-1">{d.icon}</p>
                  <p className="text-xs font-mono">
                    <span className="font-bold text-warm-700">{d.high}°</span>
                    <span className="text-warm-300 mx-1">/</span>
                    <span className="text-warm-400">{d.low}°</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Routines ────────────────────────────────────────────────────── */}
        {visibleRoutines.length > 0 && (
          <SectionCard icon={ClockIcon} title={new Date().getHours() < 12 ? '☀️ Morning Routines' : '🌙 Evening Routines'} action="All routines" onAction={() => onNavigate('routines')}>
            <div className="divide-y divide-warm-50">
              {visibleRoutines.map(routine => {
                const total   = routine.items.length
                const done    = routine.items.filter(i => i.completion_id).length
                const allDone = total > 0 && done === total
                const member  = memberMap[routine.family_member_id]
                return (
                  <div key={routine.id} className={`px-5 py-3 ${allDone ? 'opacity-60' : ''}`}>
                    {/* Routine header */}
                    <div className="flex items-center gap-2 mb-2">
                      {member && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                          style={{ backgroundColor: member.color }}>
                          {member.name[0]}
                        </div>
                      )}
                      <span className="text-xs font-semibold text-warm-600 flex-1">{routine.name}</span>
                      <span className={`text-xs font-mono ${allDone ? 'text-sage-500' : 'text-warm-400'}`}>
                        {allDone ? '✓' : `${done}/${total}`}
                      </span>
                    </div>
                    {/* Task list */}
                    <div className="space-y-1">
                      {routine.items.map(item => (
                        <button key={item.id} onClick={() => handleRoutineCheck(item)}
                          className="w-full flex items-center gap-2.5 group text-left">
                          <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                            item.completion_id ? 'bg-sage-400 border-sage-400' : 'border-warm-300 group-hover:border-sage-400'
                          }`}>
                            {item.completion_id && (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span className={`text-xs transition-colors ${
                            item.completion_id ? 'line-through text-warm-300' : 'text-warm-600 group-hover:text-warm-800'
                          }`}>{item.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}

        {/* ── Events + Chores ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-5">

          {/* Today's Events */}
          <SectionCard icon={CalendarDaysIcon} title="Today's Events" action="Open calendar" onAction={() => onNavigate('calendar')}>
            {todayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-warm-300">
                <CalendarDaysIcon className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">Nothing scheduled today</p>
              </div>
            ) : (
              <ul className="divide-y divide-warm-50">
                {todayEvents.map(event => {
                  const member = memberMap[event.family_member_id]
                  return (
                    <li key={`${event.id}-${event.start_time}`} className="flex items-center gap-3 px-5 py-3 hover:bg-warm-50 transition-colors">
                      <div className="w-16 shrink-0 text-right">
                        <span className="text-xs font-mono text-warm-400">{fmtEventTime(event)}</span>
                      </div>
                      {member && (
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: member.color }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-warm-700 truncate">{event.title}</p>
                        {member && <p className="text-xs text-warm-400">{member.name}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          {/* Family Chores */}
          <SectionCard icon={ClipboardDocumentListIcon} title="Chores" action="Open chores" onAction={() => onNavigate('chores')}>
            {memberChores.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-warm-300 text-sm">No family members yet</div>
            ) : (
              <ul className="divide-y divide-warm-50">
                {memberChores.map(({ member, overdue, dueToday, upcoming, status }) => (
                  <li key={member.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-warm-50 transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ring-2 ${
                      status === 'overdue' ? 'ring-red-400' : status === 'today' ? 'ring-amber-400' : 'ring-sage-300'
                    }`} style={{ backgroundColor: member.color }}>
                      {getInitials(member.name)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-warm-700">{member.name}</p>
                      <p className="text-xs text-warm-400">
                        {overdue > 0 && <span className="text-red-500 font-medium">{overdue} overdue</span>}
                        {overdue > 0 && dueToday > 0 && <span className="mx-1 text-warm-200">·</span>}
                        {dueToday > 0 && <span className="text-amber-500 font-medium">{dueToday} today</span>}
                        {(overdue > 0 || dueToday > 0) && upcoming > 0 && <span className="mx-1 text-warm-200">·</span>}
                        {upcoming > 0 && <span>{upcoming} this week</span>}
                        {overdue === 0 && dueToday === 0 && upcoming === 0 && <span className="text-sage-500">All clear ✓</span>}
                      </p>
                    </div>
                    {status === 'overdue' && <span className="text-xs bg-red-50 text-red-400 px-2 py-0.5 rounded-full font-medium">Overdue</span>}
                    {status === 'today'   && <span className="text-xs bg-amber-50 text-amber-500 px-2 py-0.5 rounded-full font-medium">Due today</span>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* ── Shopping ────────────────────────────────────────────────────── */}
        <div>
          <SectionCard icon={ShoppingCartIcon} title="Shopping List" action="Open list" onAction={() => onNavigate('shopping')}>
            {activeShop.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-warm-300">
                <CheckCircleIcon className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">List is empty</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-4 flex items-center gap-3">
                  <div className="text-4xl font-bold text-warm-700 font-mono">{activeShop.length}</div>
                  <div>
                    <p className="text-sm font-semibold text-warm-600">item{activeShop.length !== 1 ? 's' : ''} to buy</p>
                    <p className="text-xs text-warm-400">Tap to open the full list</p>
                  </div>
                </div>
                <ul className="px-5 pb-4 space-y-1">
                  {activeShop.slice(0, 5).map(item => (
                    <li key={item.id} className="flex items-center gap-2 text-sm text-warm-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-warm-300 shrink-0" />
                      <span className="truncate">{[item.brand, item.description].filter(Boolean).join(' ')}</span>
                    </li>
                  ))}
                  {activeShop.length > 5 && (
                    <li className="text-xs text-warm-400 pl-3.5">+ {activeShop.length - 5} more</li>
                  )}
                </ul>
              </>
            )}
          </SectionCard>

        </div>
      </div>
    </div>
  )
}
