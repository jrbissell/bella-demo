// Default: Austin, TX (neutral demo location)
const LAT = parseFloat(import.meta.env.VITE_WEATHER_LAT ?? '30.2672')
const LON = parseFloat(import.meta.env.VITE_WEATHER_LON ?? '-97.7431')

export const WMO = {
  0:  { icon: '☀️',  label: 'Clear' },
  1:  { icon: '🌤️', label: 'Mainly clear' },
  2:  { icon: '⛅',  label: 'Partly cloudy' },
  3:  { icon: '☁️',  label: 'Overcast' },
  45: { icon: '🌫️', label: 'Fog' },
  48: { icon: '🌫️', label: 'Icy fog' },
  51: { icon: '🌦️', label: 'Light drizzle' },
  53: { icon: '🌦️', label: 'Drizzle' },
  55: { icon: '🌧️', label: 'Heavy drizzle' },
  61: { icon: '🌧️', label: 'Light rain' },
  63: { icon: '🌧️', label: 'Rain' },
  65: { icon: '🌧️', label: 'Heavy rain' },
  71: { icon: '🌨️', label: 'Light snow' },
  73: { icon: '🌨️', label: 'Snow' },
  75: { icon: '❄️',  label: 'Heavy snow' },
  77: { icon: '❄️',  label: 'Snow grains' },
  80: { icon: '🌦️', label: 'Light showers' },
  81: { icon: '🌧️', label: 'Showers' },
  82: { icon: '⛈️',  label: 'Heavy showers' },
  85: { icon: '🌨️', label: 'Snow showers' },
  86: { icon: '❄️',  label: 'Heavy snow showers' },
  95: { icon: '⛈️',  label: 'Thunderstorm' },
  96: { icon: '⛈️',  label: 'T-storm + hail' },
  99: { icon: '⛈️',  label: 'T-storm + hail' },
}

export function wmo(code) {
  return WMO[code] ?? { icon: '🌡️', label: 'Unknown' }
}

export function windDir(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

export async function fetchWeather() {
  const params = new URLSearchParams({
    latitude:           LAT,
    longitude:          LON,
    current:            'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,is_day',
    daily:              'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit:   'fahrenheit',
    wind_speed_unit:    'mph',
    precipitation_unit: 'inch',
    timezone:           import.meta.env.VITE_TIMEZONE ?? 'America/Chicago',
    forecast_days:      '16',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error('Weather unavailable')
  return res.json()
}
