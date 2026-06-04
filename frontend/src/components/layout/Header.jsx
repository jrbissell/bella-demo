import { useState } from 'react'
import { ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { calendarApi } from '../../api/calendar'
import { fetchWeather, wmo, windDir } from '../../api/weather'

const PAGE_TITLES = {
  calendar: 'Calendar',
  chores:   'Chores',
  shopping: 'Shopping',
  tracker:  'Tracker',
}

export default function Header({ page }) {
  const queryClient = useQueryClient()
  const [syncMsg, setSyncMsg] = useState(null)

  const { data: status } = useQuery({
    queryKey: ['sync-status'],
    queryFn: calendarApi.syncStatus,
    refetchInterval: 30_000,
  })

  const { data: wx } = useQuery({
    queryKey: ['weather'],
    queryFn: fetchWeather,
    staleTime: 30 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
  })

  const cur    = wx?.current
  const curWmo = cur ? wmo(cur.weather_code) : null

  const syncMutation = useMutation({
    mutationFn: calendarApi.triggerSync,
    onSuccess: (data) => {
      setSyncMsg({ ok: data.status !== 'error', text: data.message })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setTimeout(() => setSyncMsg(null), 4000)
    },
    onError: () => {
      setSyncMsg({ ok: false, text: 'Sync failed' })
      setTimeout(() => setSyncMsg(null), 4000)
    },
  })

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-warm-200 shrink-0">
      <h1 className="text-base font-semibold text-warm-700 w-24 shrink-0">
        {PAGE_TITLES[page] || 'Bella'}
      </h1>

      {cur && (
        <div className="flex items-center gap-2 text-sm text-warm-600">
          <span className="text-xl leading-none">{curWmo.icon}</span>
          <span className="font-semibold text-warm-700">{Math.round(cur.temperature_2m)}°F</span>
          <span className="hidden md:block text-warm-400 text-xs">
            Feels {Math.round(cur.apparent_temperature)}° · {cur.relative_humidity_2m}% humidity · {windDir(cur.wind_direction_10m)} {Math.round(cur.wind_speed_10m)} mph
          </span>
        </div>
      )}

      <div className="flex items-center gap-4">
        {syncMsg && (
          <span className={`flex items-center gap-1.5 text-sm font-medium ${syncMsg.ok ? 'text-sage-500' : 'text-red-500'}`}>
            {syncMsg.ok
              ? <CheckCircleIcon className="w-4 h-4" />
              : <ExclamationCircleIcon className="w-4 h-4" />}
            {syncMsg.text}
          </span>
        )}

        {status && (
          <span className="hidden sm:block text-xs text-warm-300">
            {status.icloud_configured
              ? `iCloud · every ${status.sync_interval_minutes}m`
              : 'iCloud not configured'}
          </span>
        )}

        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-1.5 text-sm font-medium text-warm-400 hover:text-warm-500 transition-colors disabled:opacity-40 px-3 py-1.5 rounded-lg hover:bg-warm-50"
          title="Sync with iCloud now"
        >
          <ArrowPathIcon className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sync</span>
        </button>
      </div>
    </header>
  )
}
