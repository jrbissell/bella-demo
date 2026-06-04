import { useState } from 'react'
import { XMarkIcon, MagnifyingGlassIcon, ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline'
import { shoppingApi } from '../../api/shopping'

const TIMEOUT_MS = 30_000

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

function race(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

// ── Step 1: Search input ──────────────────────────────────────────────────────
function SearchStep({ query, setQuery, onSearch, searching, error }) {
  const submit = (e) => { e.preventDefault(); if (query.trim()) onSearch() }
  return (
    <form onSubmit={submit} className="px-5 py-5 space-y-4">
      <p className="text-xs text-warm-400">
        Search for a generic product — no brand needed. Be specific about size.
      </p>
      <div className="relative">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. Whole Milk 1 Gallon"
          className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <MagnifyingGlassIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-300 pointer-events-none" />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={!query.trim() || searching}
        className="w-full py-2.5 text-sm font-medium text-white bg-warm-500 hover:bg-warm-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        {searching ? 'Searching…' : 'Search Products'}
      </button>
    </form>
  )
}

// ── Step 2: Product picker ────────────────────────────────────────────────────
function PickStep({ query, products, stores, onSelectPrice, onPick, onBack, loadingId, error }) {
  return (
    <div>
      <div className="px-5 py-3 border-b border-warm-200">
        <p className="text-xs text-warm-400">
          Results for <span className="font-medium text-warm-700">"{query}"</span> — tap a price to select
        </p>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <div className="divide-y divide-warm-200 max-h-[65vh] overflow-y-auto">
        {products.map((p, i) => {
          const isLoading = loadingId === i
          const pricePairs = p.prices
            ? Object.entries(p.prices).filter(([, v]) => v != null)
            : []
          return (
            <div key={i} className="px-5 py-3.5">
              {/* Product info */}
              <div className="min-w-0">
                {p.brand && (
                  <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide">{p.brand}</p>
                )}
                <p className="text-sm font-medium text-warm-700 mt-0.5">{p.description}</p>
                {p.size && (
                  <span className="inline-block mt-1 text-[11px] font-medium text-warm-400 bg-warm-100 rounded px-1.5 py-0.5">
                    {p.size}
                  </span>
                )}
              </div>
              {/* Store price buttons */}
              {pricePairs.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pricePairs.map(([storeName, price]) => {
                    const bellaStore = matchBellaStore(storeName, stores)
                    return (
                      <button
                        key={storeName}
                        onClick={() => onSelectPrice(p, bellaStore?.id ?? null, Number(price))}
                        disabled={loadingId != null}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 hover:border-green-400 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <span className="text-warm-400">{bellaStore?.name ?? storeName}</span>
                        <span className="font-bold">${Number(price).toFixed(2)}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <button
                  onClick={() => onPick(p, i)}
                  disabled={loadingId != null}
                  className="mt-2 flex items-center gap-1 text-xs text-warm-500 hover:text-warm-600 disabled:opacity-50"
                >
                  {isLoading
                    ? <div className="w-3 h-3 border-2 border-warm-200 border-t-transparent rounded-full animate-spin" />
                    : <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                  }
                  Check prices
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="px-5 py-3 border-t border-warm-200">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-warm-400 hover:text-warm-700">
          <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to search
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Price results ─────────────────────────────────────────────────────
function PricesStep({ product, results, stores, onSelect, onBack }) {
  const rows = results.map(r => ({ ...r, bellaStore: matchBellaStore(r.store, stores) }))

  return (
    <div>
      <div className="px-5 py-3 border-b border-warm-200 space-y-0.5">
        {product.brand && (
          <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide">{product.brand}</p>
        )}
        <p className="text-sm font-medium text-warm-700">{product.description}</p>
        {product.size && (
          <span className="inline-block text-[11px] font-medium text-warm-400 bg-warm-100 rounded px-1.5 py-0.5">{product.size}</span>
        )}
      </div>
      <div className="divide-y divide-warm-200">
        {rows.map(r => (
          <div key={r.store} className="flex items-center justify-between px-5 py-3.5">
            <p className="text-sm font-medium text-warm-700">
              {r.bellaStore ? r.bellaStore.name : r.store}
            </p>
            <div className="flex items-center gap-3 ml-4 shrink-0">
              <span className={`text-sm font-semibold tabular-nums ${r.price != null ? 'text-warm-700' : 'text-warm-300'}`}>
                {r.price != null ? `$${r.price.toFixed(2)}` : '—'}
              </span>
              {r.price != null ? (
                <button
                  onClick={() => onSelect(r.bellaStore?.id ?? null, r.price)}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-50 transition-colors"
                >
                  <CheckIcon className="w-3 h-3" /> Use
                </button>
              ) : (
                <span className="w-[58px]" />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-warm-200 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-warm-400 hover:text-warm-700">
          <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to results
        </button>
        <p className="text-xs text-warm-300">Prices from web — verify in-store.</p>
      </div>
    </div>
  )
}

// ── Loading overlay ───────────────────────────────────────────────────────────
function PriceLoadingStep({ productLabel }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 px-5">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-16 h-16 rounded-full border-4 border-warm-200 animate-ping opacity-40" />
        <div className="relative w-14 h-14 rounded-full bg-warm-50 flex items-center justify-center">
          <MagnifyingGlassIcon className="w-7 h-7 text-warm-500 animate-pulse" />
        </div>
      </div>
      <p className="text-sm font-medium text-warm-700 text-center">
        Finding prices for<br />
        <span className="text-warm-500">{productLabel}</span>
      </p>
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
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function ProductSearchModal({ initialQuery = '', stores, onSelect, onProductPick, onClose }) {
  const [step, setStep]           = useState('search')  // search | pick | price-loading | prices
  const [query, setQuery]         = useState(initialQuery)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [pickError, setPickError]   = useState(null)
  const [products, setProducts]   = useState([])
  const [loadingId, setLoadingId] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [priceResults, setPriceResults] = useState(null)

  const handleSearch = async () => {
    setSearching(true)
    setSearchError(null)
    try {
      const data = await race(shoppingApi.productSearch(query.trim()), TIMEOUT_MS)
      if (!data.products?.length) {
        setSearchError('No products found — try a different search term.')
        return
      }
      setProducts(data.products)
      setStep('pick')
    } catch (err) {
      setSearchError(err.message === 'timeout' ? 'Search timed out — try again.' : 'Search failed — try again.')
    } finally {
      setSearching(false)
    }
  }

  const handlePickProduct = async (product, idx) => {
    setLoadingId(idx)
    setSelectedProduct(product)
    setStep('price-loading')
    onProductPick?.(product)
    try {
      const data = await race(
        shoppingApi.priceCheck({
          upc:         null,
          description: product.description,
          brand:       product.brand || null,
          size:        product.size  || null,
        }),
        TIMEOUT_MS,
      )
      setPriceResults(data.results)
      setStep('prices')
    } catch (err) {
      setStep('pick')
      setPickError(err.message === 'timeout' ? 'Price lookup timed out — try again.' : 'Price lookup failed — try again.')
    } finally {
      setLoadingId(null)
    }
  }

  // Called when user taps a price button directly in the picker
  const handleSelectFromPicker = (product, storeId, price) => {
    onProductPick?.(product)
    onSelect(storeId, price, product)
  }

  // Called when user taps "Use" in the fallback price results step
  const handleSelect = (storeId, price) => {
    onSelect(storeId, price, selectedProduct)
  }

  const productLabel = selectedProduct
    ? [selectedProduct.brand, selectedProduct.description].filter(Boolean).join(' ')
    : ''

  const title =
    step === 'search'        ? 'Search Products' :
    step === 'pick'          ? 'Select a Product' :
    step === 'price-loading' ? 'Checking Prices…' :
                               'Price Results'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">{title}</h2>
          {step !== 'price-loading' && (
            <button onClick={onClose} className="text-warm-300 hover:text-warm-400">
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        {step === 'search' && (
          <SearchStep
            query={query}
            setQuery={setQuery}
            onSearch={handleSearch}
            searching={searching}
            error={searchError}
          />
        )}
        {step === 'pick' && (
          <PickStep
            query={query}
            products={products}
            stores={stores}
            onSelectPrice={handleSelectFromPicker}
            onPick={handlePickProduct}
            onBack={() => { setStep('search'); setSearchError(null); setPickError(null) }}
            loadingId={loadingId}
            error={pickError}
          />
        )}
        {step === 'price-loading' && (
          <PriceLoadingStep productLabel={productLabel} />
        )}
        {step === 'prices' && priceResults && (
          <PricesStep
            product={selectedProduct}
            results={priceResults}
            stores={stores}
            onSelect={handleSelect}
            onBack={() => setStep('pick')}
          />
        )}
      </div>
    </div>
  )
}
