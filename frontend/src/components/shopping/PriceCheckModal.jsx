import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

function normalizeName(s) {
  return s.toLowerCase().replace(/[\s\-\.]/g, '')
}

function matchBellaStore(geminiStoreName, stores) {
  const g = normalizeName(geminiStoreName)
  return stores.find(s => {
    const b = normalizeName(s.name)
    return b.includes(g) || g.includes(b)
  }) || null
}

export default function PriceCheckModal({ itemName, loading, results, stores, onSelect, onClose }) {
  const rows = (results || []).map(r => ({
    ...r,
    bellaStore: matchBellaStore(r.store, stores),
  }))

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60" style={{ zIndex: 100 }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-warm-200">
          <div>
            <h2 className="text-base font-semibold text-warm-700">Price Check</h2>
            <p className="text-xs text-warm-400 mt-0.5 line-clamp-1">{itemName}</p>
          </div>
          {!loading && (
            <button onClick={onClose} className="text-warm-300 hover:text-warm-400 mt-0.5 ml-3 shrink-0">
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-10 px-5">
            {/* Animated magnifying glass */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-16 h-16 rounded-full border-4 border-warm-200 animate-ping opacity-40" />
              <div className="relative w-14 h-14 rounded-full bg-warm-50 flex items-center justify-center">
                <MagnifyingGlassIcon className="w-7 h-7 text-warm-500 animate-pulse" />
              </div>
            </div>
            <p className="text-sm font-medium text-warm-700">Searching grocery prices…</p>
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {['Costco', 'HEB', 'Kroger', 'Walmart', 'Whole Foods'].map((s, i) => (
                <span
                  key={s}
                  className="text-xs px-2 py-0.5 rounded-full bg-warm-50 text-warm-500 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-warm-200">
            {rows.map(r => (
              <div key={r.store} className="flex items-center justify-between px-5 py-3.5">
                <p className="text-sm font-medium text-warm-700 truncate">
                  {r.bellaStore ? r.bellaStore.name : r.store}
                </p>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <span className={`text-sm font-semibold tabular-nums ${r.price != null ? 'text-warm-700' : 'text-warm-300'}`}>
                    {r.price != null ? `$${r.price.toFixed(2)}` : '—'}
                  </span>
                  {r.price != null ? (
                    <button
                      onClick={() => onSelect(r.bellaStore?.id ?? null, r.price)}
                      className="px-3 py-1 text-xs font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-50 transition-colors"
                    >
                      Select
                    </button>
                  ) : (
                    <span className="w-[58px]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-warm-200">
            <p className="text-xs text-warm-300">Prices from web search — verify in-store.</p>
            <button onClick={onClose} className="text-xs text-warm-400 hover:text-warm-700">Close</button>
          </div>
        )}
      </div>
    </div>
  )
}
