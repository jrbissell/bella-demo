import { useState, useEffect } from 'react'
import { XMarkIcon, MagnifyingGlassIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'
import { shoppingApi } from '../../api/shopping'
import PriceCompareModal from './PriceCompareModal'

const SIZE_UNITS = ['oz', 'fl oz', 'lbs', 'g', 'kg', 'L', 'mL', 'ct', 'each', 'pack', 'box', 'bag', 'can', 'bottle', 'jar', 'roll', 'dozen']

function sanitizeUnit(unit = '') {
  return unit.replace(/\s*PRODUCT\s*:.*$/i, '').trim()
}

function parseUnit(unit = '') {
  const clean = sanitizeUnit(unit)
  const m = clean.match(/^(\d+(?:\.\d+)?)\s+(.+)$/)
  if (m) return { size_value: m[1], size_unit: m[2] }
  return { size_value: '', size_unit: clean || 'oz' }
}

const EMPTY = {
  brand: '', description: '', upc: '', store_id: '', department_id: '',
  quantity: 1, size_value: '', size_unit: 'oz',
  price_per_unit: '', taxable: false, tax_rate: 8.25, notes: '',
}

export default function ItemModal({ item, stores, departments, onSave, onDelete, onClose, autoLookup = false }) {
  const [form, setForm]             = useState(EMPTY)
  const [upcLoading, setUpcLoading] = useState(false)
  const [upcError, setUpcError]     = useState(null)
  const [showPrices, setShowPrices] = useState(false)

  const UNIT_MAP = { lb:'lbs', pound:'lbs', pounds:'lbs', gram:'g', grams:'g',
    liter:'L', liters:'L', milliliter:'mL', milliliters:'mL',
    'fl. oz':'fl oz', 'fl.oz':'fl oz', count:'ct' }

  function titleCase(s) {
    return s.replace(/\b\w/g, c => c.toUpperCase())
  }
  function capFirst(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  }

  async function lookupUpc(upcArg) {
    const upc = upcArg ?? form.upc
    if (!upc) return
    setUpcLoading(true)
    setUpcError(null)
    try {
      // 1. Open Food Facts — product info
      const res  = await fetch(`https://world.openfoodfacts.org/api/v2/product/${upc}.json`)
      const data = await res.json()
      if (data.status !== 1) { setUpcError('Product not found'); return }

      const p           = data.product
      const brand       = titleCase(p.brands?.split(',')[0]?.trim() ?? '')
      const description = capFirst(p.product_name ?? '')

      let size_value = '', size_unit = form.size_unit
      // OFf fills `quantity` inconsistently; try several fallback fields
      const quantityStr =
        p.quantity ||
        (p.product_quantity && p.product_quantity_unit
          ? `${p.product_quantity} ${p.product_quantity_unit}`
          : null) ||
        p.net_weight ||
        null
      if (quantityStr) {
        // strip leading text like "Net Wt ", "e ", etc. before the number
        const m = quantityStr.match(/([\d.]+)\s*([a-zA-Z]+)/)
        if (m) {
          size_value = m[1]
          const raw  = m[2].trim()
          const norm = UNIT_MAP[raw.toLowerCase()] ?? raw.toLowerCase()
          size_unit  = SIZE_UNITS.includes(norm) ? norm : SIZE_UNITS.includes(raw.toLowerCase()) ? raw.toLowerCase() : form.size_unit
        }
      }

      // 2. AI classify — department + taxable (best-effort)
      let department_id = form.department_id
      let taxable       = form.taxable
      try {
        const sizeStr = size_value ? `${size_value} ${size_unit}` : ''
        const clRes   = await fetch('/price-grabber/api/classify', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ brand, description, size: sizeStr }),
        })
        if (clRes.ok) {
          const cl      = await clRes.json()
          const matched = departments.find(d =>
            d.name.toLowerCase() === (cl.department ?? '').toLowerCase()
          )
          if (matched) department_id = matched.id
          if (cl.taxable != null) taxable = cl.taxable
        }
      } catch { /* classify is best-effort */ }

      setForm(f => ({
        ...f,
        brand:        brand        || f.brand,
        description:  description  || f.description,
        size_value:   size_value   || f.size_value,
        size_unit,
        department_id,
        taxable,
      }))
    } catch {
      setUpcError('Lookup failed')
    } finally {
      setUpcLoading(false)
    }
  }

  useEffect(() => {
    if (item) {
      const { size_value, size_unit } = parseUnit(item.unit)
      const upc = item.upc ?? ''
      setForm({
        brand:          item.brand          ?? '',
        description:    item.description    ?? '',
        upc,
        store_id:       item.store_id       ?? '',
        department_id:  item.department_id  ?? '',
        quantity:       item.quantity       ?? 1,
        size_value,
        size_unit,
        price_per_unit: item.price_per_unit ?? '',
        taxable:        item.taxable        ?? false,
        tax_rate:       item.tax_rate       ?? 8.25,
        notes:          item.notes          ?? '',
      })
      // auto-trigger lookup when opened from a barcode scan (has UPC but no id)
      if (autoLookup && upc && !item.id) {
        lookupUpc(upc)
      }
    } else {
      const def = stores.find(s => s.is_default)
      setForm({ ...EMPTY, store_id: def?.id ?? '' })
    }
  }, [item, stores])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const unit = form.size_value ? `${form.size_value} ${form.size_unit}` : form.size_unit
    onSave({
      brand:          form.brand || null,
      description:    form.description,
      upc:            form.upc   || null,
      store_id:       form.store_id      ? Number(form.store_id)      : null,
      department_id:  form.department_id ? Number(form.department_id) : null,
      quantity:       Number(form.quantity),
      unit,
      price_per_unit: form.price_per_unit !== '' ? Number(form.price_per_unit) : null,
      taxable:        form.taxable,
      tax_rate:       Number(form.tax_rate),
      notes:          form.notes || null,
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
            <h2 className="text-base font-semibold text-warm-700">
              {item ? 'Edit Item' : 'Add Item'}
            </h2>
            <button onClick={onClose} className="text-warm-300 hover:text-warm-400">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 overflow-y-auto max-h-[65vh]">
            {/* Description + Brand */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-warm-400 mb-1">Description *</label>
                <input
                  required
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="e.g. Whole Milk"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-1">Brand</label>
                <input
                  value={form.brand}
                  onChange={e => set('brand', e.target.value)}
                  className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="e.g. Horizon Organic"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-warm-400 mb-1">UPC</label>
                <div className="flex gap-1.5">
                  <input
                    value={form.upc}
                    onChange={e => { set('upc', e.target.value); setUpcError(null) }}
                    className="flex-1 min-w-0 text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="Barcode"
                  />
                  {form.upc && (<>
                    <button
                      type="button"
                      onClick={lookupUpc}
                      disabled={upcLoading}
                      title="Look up product info"
                      className="shrink-0 flex items-center gap-1 px-2 py-2 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-40 transition-colors"
                    >
                      <MagnifyingGlassIcon className={`w-3.5 h-3.5 ${upcLoading ? 'animate-pulse' : ''}`} />
                      {upcLoading ? '…' : 'Info'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPrices(true)}
                      title="Compare store prices"
                      className="shrink-0 flex items-center gap-1 px-2 py-2 text-xs font-medium text-sage-600 border border-sage-200 rounded-lg hover:bg-sage-50 transition-colors"
                    >
                      <CurrencyDollarIcon className="w-3.5 h-3.5" />
                      Prices
                    </button>
                  </>)}
                </div>
                {upcError && <p className="text-xs text-red-500 mt-1">{upcError}</p>}
              </div>
            </div>

            {/* Store + Department */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-1">Store</label>
                <select
                  value={form.store_id}
                  onChange={e => set('store_id', e.target.value)}
                  className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="">— None —</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_default ? ' ★' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-1">Department</label>
                <select
                  value={form.department_id}
                  onChange={e => set('department_id', e.target.value)}
                  className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="">— None —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            {/* Quantity + Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-1">Qty (each)</label>
                <input
                  type="number" min="0" step="1"
                  value={form.quantity}
                  onChange={e => set('quantity', e.target.value)}
                  className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-1">Size</label>
                <div className="flex gap-1.5">
                  <input
                    type="number" min="0" step="0.01"
                    value={form.size_value}
                    onChange={e => set('size_value', e.target.value)}
                    placeholder="36"
                    className="w-20 text-sm border border-warm-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <select
                    value={form.size_unit}
                    onChange={e => set('size_unit', e.target.value)}
                    className="flex-1 text-sm border border-warm-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    {SIZE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Price + Tax */}
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-warm-400 mb-1">Price / unit ($)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.price_per_unit}
                  onChange={e => set('price_per_unit', e.target.value)}
                  className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  id="taxable"
                  checked={form.taxable}
                  onChange={e => set('taxable', e.target.checked)}
                  className="w-4 h-4 rounded text-warm-500"
                />
                <label htmlFor="taxable" className="text-sm text-warm-700 select-none">Taxable</label>
              </div>
              {form.taxable && (
                <div>
                  <label className="block text-xs font-medium text-warm-400 mb-1">Tax rate (%)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.tax_rate}
                    onChange={e => set('tax_rate', e.target.value)}
                    className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-warm-400 mb-1">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                placeholder="e.g. check expiration date"
              />
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-warm-200 gap-3">
            <div className="flex items-center gap-3">
              {item && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="text-sm text-red-500 hover:text-red-700 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-50 transition-colors"
              >
                {item ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPrices && (
        <PriceCompareModal
          upc={form.upc}
          stores={stores}
          onSelect={(price, storeId) => {
            set('price_per_unit', Number(price.toFixed(2)))
            if (storeId != null) set('store_id', storeId)
            setShowPrices(false)
          }}
          onClose={() => setShowPrices(false)}
        />
      )}
    </>
  )
}
