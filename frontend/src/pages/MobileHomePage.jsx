import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { fetchWeather, wmo, windDir } from '../api/weather'
import { mealsApi } from '../api/meals'
import { RRule } from 'rrule'

const DAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONS  = ['January','February','March','April','May','June','July','August','September','October','November','December']

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

function fmt12(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' })
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function mealOnDate(plan, target) {
  if (!plan.recurrence_rule) return plan.date === target
  try {
    const dtstart = new Date(plan.date + 'T12:00:00Z')
    const opts    = RRule.parseString(plan.recurrence_rule)
    opts.dtstart  = dtstart
    const rule    = new RRule(opts)
    const s = new Date(target + 'T00:00:00Z')
    const e = new Date(target + 'T23:59:59Z')
    return rule.between(s, e, true).length > 0
  } catch { return plan.date === target }
}

export default function MobileHomePage({ onMenu }) {
  const now  = useClock()
  const h    = now.getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const today = todayStr()

  const { data: weather } = useQuery({
    queryKey: ['weather'],
    queryFn:  fetchWeather,
    staleTime: 30 * 60 * 1000,
  })

  const { data: mealPlan = [] } = useQuery({
    queryKey: ['meal-plan'],
    queryFn:  mealsApi.listPlan,
    staleTime: 5 * 60 * 1000,
  })

  const { data: meals = [] } = useQuery({
    queryKey: ['meals'],
    queryFn:  mealsApi.listMeals,
    staleTime: 5 * 60 * 1000,
  })

  const cur     = weather?.current
  const cond    = cur ? wmo(cur.weather_code) : null
  const temp    = cur ? Math.round(cur.temperature_2m) : null
  const feels   = cur ? Math.round(cur.apparent_temperature) : null
  const humid   = cur?.relative_humidity_2m
  const wind    = cur ? Math.round(cur.wind_speed_10m) : null
  const wDir    = cur ? windDir(cur.wind_direction_10m) : ''

  // 5-day forecast
  const forecast = weather?.daily
    ? weather.daily.time.slice(0, 5).map((d, i) => ({
        date:  d,
        ...wmo(weather.daily.weather_code[i]),
        high:  Math.round(weather.daily.temperature_2m_max[i]),
        low:   Math.round(weather.daily.temperature_2m_min[i]),
        precip: weather.daily.precipitation_probability_max[i],
      }))
    : []

  // Tonight's dinner
  const todayPlan = mealPlan.find(p => mealOnDate(p, today))
  const tonightMeal = todayPlan
    ? (meals.find(m => m.id === todayPlan.meal_id)?.name ?? todayPlan.title ?? null)
    : null

  const d = now
  const dateStr = `${DAYS[d.getDay()]}, ${MONS[d.getMonth()]} ${d.getDate()}`

  return (
    <div className="flex flex-col h-full bg-warm-50 overflow-hidden">

      {/* Header */}
      <div className="flex items-center px-4 bg-white border-b border-warm-200 shrink-0 safe-top">
        <div className="flex items-center" style={{ height: 52 }}>
          <button
            onClick={onMenu}
            className="p-2 -ml-2 text-warm-500 active:bg-warm-100 rounded-xl"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
        </div>
        <span className="flex-1 text-center text-base font-semibold text-warm-700">Bella</span>
        <div className="w-10" />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 safe-bottom">

        {/* Greeting + date */}
        <div>
          <p className="text-sm text-warm-400">{greeting}</p>
          <p className="text-2xl font-bold text-warm-700 leading-tight">{dateStr}</p>
          <p className="text-sm text-warm-400 mt-0.5">{fmt12(now)}</p>
        </div>

        {/* Current weather card */}
        {cond ? (
          <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-6xl font-bold text-warm-700 leading-none">{temp}°</p>
                  <p className="text-sm text-warm-400 mt-1">{cond.label}</p>
                </div>
                <span className="text-6xl leading-none select-none">{cond.icon}</span>
              </div>

              {/* Detail pills */}
              <div className="flex gap-3 mt-4 flex-wrap">
                <DetailPill label="Feels" value={`${feels}°`} />
                <DetailPill label="Humidity" value={`${humid}%`} />
                <DetailPill label="Wind" value={`${wDir} ${wind} mph`} />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-warm-200 px-5 py-6 text-center text-warm-300 text-sm">
            Loading weather…
          </div>
        )}

        {/* 5-day forecast */}
        {forecast.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
            <p className="text-xs font-semibold text-warm-400 uppercase tracking-wider px-5 pt-4 pb-2">
              5-Day Forecast
            </p>
            <div className="divide-y divide-warm-100">
              {forecast.map((day, i) => {
                const d    = new Date(day.date + 'T12:00:00')
                const name = i === 0 ? 'Today' : DAYS[d.getDay()].slice(0, 3)
                return (
                  <div key={day.date} className="flex items-center px-5 py-3 gap-3">
                    <span className="w-10 text-sm text-warm-500 font-medium">{name}</span>
                    <span className="text-lg leading-none">{day.icon}</span>
                    <span className="flex-1 text-xs text-warm-400">{day.label}</span>
                    {day.precip > 0 && (
                      <span className="text-xs text-blue-400 font-medium">{day.precip}%</span>
                    )}
                    <span className="text-sm font-semibold text-warm-700">{day.high}°</span>
                    <span className="text-sm text-warm-300">{day.low}°</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tonight's dinner */}
        {tonightMeal && (
          <div className="bg-white rounded-2xl shadow-sm border border-warm-200 px-5 py-4">
            <p className="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-1">
              Tonight's Dinner
            </p>
            <p className="text-base font-semibold text-warm-700">🍽️ {tonightMeal}</p>
          </div>
        )}

      </div>
    </div>
  )
}

function DetailPill({ label, value }) {
  return (
    <div className="bg-warm-50 rounded-xl px-3 py-2 flex flex-col items-center min-w-[72px]">
      <span className="text-[10px] text-warm-300 uppercase tracking-wider font-medium">{label}</span>
      <span className="text-sm font-semibold text-warm-600 mt-0.5">{value}</span>
    </div>
  )
}
