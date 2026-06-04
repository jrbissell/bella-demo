import { useEffect, useRef, useState } from 'react'
import { XMarkIcon, ArrowTopRightOnSquareIcon, CheckIcon } from '@heroicons/react/24/outline'

const STORES = [
  { key: 'kroger',     label: 'Kroger',      color: '#1d4ed8', match: ['kroger'] },
  { key: 'walmart',    label: 'Walmart',     color: '#0071dc', match: ['walmart'] },
  { key: 'wholefoods', label: 'Whole Foods', color: '#00674b', match: ['whole'] },
  { key: 'heb',        label: 'H-E-B',       color: '#e31837', match: ['heb', 'h-e-b'] },
]

function matchStore(stores, key) {
  const cfg = STORES.find(s => s.key === key)
  if (!cfg) return null
  return stores.find(s => cfg.match.some(m => s.name.toLowerCase().includes(m))) ?? null
}

export default function PriceCompareModal({ upc, stores, onSelect, onClose }) {
  const [results, setResults]       = useState({})
  const [manualPrices, setManualPrices] = useState({})
  const esRef = useRef(null)

  useEffect(() => {
    setResults({})
    const es = new EventSource(`/price-grabber/api/compare?upc=${encodeURIComponent(upc)}`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setResults(prev => ({ ...prev, [data.store]: data }))
      } catch {}
    }
    es.addEventListener('done', () => { es.close(); esRef.current = null })
    es.onerror = () => { es.close(); esRef.current = null }

    return () => { es.close() }
  }, [upc])

  function handlePick(storeKey, price) {
    const matched = matchStore(stores, storeKey)
    onSelect(price, matched?.id ?? null)
  }

  const allDone = STORES.every(s => results[s.key] !== undefined)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-warm-200">
          <div>
            <h2 className="text-base font-semibold text-warm-700">Price Compare</h2>
            <p className="text-xs text-warm-300 font-mono mt-0.5">{upc}</p>
          </div>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400 mt-0.5">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Store rows */}
        <div className="divide-y divide-warm-100">
          {STORES.map(({ key, label, color }) => {
            const r       = results[key]
            const loading = r === undefined
            const price   = (r?.price_available || r?.price != null) ? r.price : null
            const blocked = r?.blocked
            const found   = r?.product_found
            const link    = r?.product_url || r?.search_url

            return (
              <div key={key} className="flex items-center gap-3 px-5 py-3.5">

                {/* Color dot + store name */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium text-warm-700">{label}</span>
                </div>

                {/* Link */}
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={found ? 'View product' : 'Search store'}
                    className="shrink-0 text-warm-300 hover:text-warm-500 transition-colors"
                  >
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  </a>
                )}

                {/* Price / status */}
                <div className="shrink-0 flex items-center gap-1.5">
                  {loading ? (
                    <span className="text-xs text-warm-300 animate-pulse">searching…</span>
                  ) : price != null ? (
                    <button
                      type="button"
                      onClick={() => handlePick(key, price)}
                      className="px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors"
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      ${price.toFixed(2)}
                    </button>
                  ) : (blocked || found === false) ? (
                    <>
                      <span className="text-warm-300 text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={manualPrices[key] ?? ''}
                        onChange={e => setManualPrices(p => ({ ...p, [key]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && manualPrices[key])
                            handlePick(key, parseFloat(manualPrices[key]))
                        }}
                        className="w-16 text-xs border border-warm-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                      {manualPrices[key] && (
                        <button
                          type="button"
                          onClick={() => handlePick(key, parseFloat(manualPrices[key]))}
                          className="p-1 text-sage-600 hover:text-sage-700 transition-colors"
                          title="Use this price"
                        >
                          <CheckIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-warm-300">no price</span>
                  )}
                </div>

              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-warm-200 flex items-center justify-between">
          <p className="text-xs text-warm-300">
            {allDone ? 'All stores checked.' : 'Searching stores…'}
          </p>
          <button onClick={onClose} className="text-sm text-warm-400 hover:text-warm-600 transition-colors">
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}
