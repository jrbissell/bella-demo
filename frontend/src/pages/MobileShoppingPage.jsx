import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, TrashIcon, ShoppingBagIcon, BookmarkIcon, Bars3Icon, QrCodeIcon } from '@heroicons/react/24/outline'
import { shoppingApi } from '../api/shopping'
import ItemModal from '../components/shopping/ItemModal'
import StaplesDrawer from '../components/shopping/StaplesDrawer'
import MobileBarcodeScanner from '../components/shopping/MobileBarcodeScanner'

function lineTotal(item) {
  if (!item.price_per_unit) return 0
  const base = item.price_per_unit * item.quantity
  return item.taxable ? base * (1 + item.tax_rate / 100) : base
}

function fmt(n) { return n.toFixed(2) }

function MobileItemRow({ item, onToggle, onEdit }) {
  const total = lineTotal(item)
  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-warm-200 active:bg-warm-100 ${item.completed ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={item.completed}
        onChange={() => onToggle(item)}
        className="mt-0.5 w-5 h-5 rounded text-warm-500 border-warm-200 shrink-0 cursor-pointer"
      />
      <button className="flex-1 text-left min-w-0" onClick={() => onEdit(item)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium text-warm-700 leading-snug ${item.completed ? 'line-through' : ''}`}>
              {item.brand && <span className="font-normal text-warm-400">{item.brand} </span>}
              {item.description}
            </p>
            {item.unit && (
              <p className="text-xs text-warm-300 mt-0.5">{item.unit}</p>
            )}
            {item.upc && (
              <p className="text-xs font-mono text-warm-300 mt-0.5">{item.upc}</p>
            )}
            <p className="text-xs text-warm-400 mt-0.5">
              Qty: {item.quantity}
              {item.price_per_unit ? ` @ $${fmt(item.price_per_unit)}` : ''}
              {item.taxable ? <span className="ml-1 text-amber-600">+tax</span> : null}
            </p>
          </div>
          {total > 0 && (
            <span className="text-sm font-semibold text-warm-700 shrink-0 pt-0.5">${fmt(total)}</span>
          )}
        </div>
      </button>
    </div>
  )
}

export default function MobileShoppingPage({ onMenu }) {
  const qc = useQueryClient()
  const [selectedStore, setSelectedStore] = useState('all')
  const [modal, setModal]         = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [autoLookup, setAutoLookup] = useState(false)
  const [scanning, setScanning]   = useState(false)
  const [showStaples, setShowStaples] = useState(false)

  const { data: stores      = [] } = useQuery({ queryKey: ['stores'],         queryFn: shoppingApi.listStores })
  const { data: departments = [] } = useQuery({ queryKey: ['departments'],    queryFn: shoppingApi.listDepts })
  const { data: items       = [] } = useQuery({ queryKey: ['shopping-items'], queryFn: shoppingApi.listItems })
  const { data: staples     = [] } = useQuery({ queryKey: ['staples'],        queryFn: shoppingApi.listStaples })

  const invalidateItems = () => qc.invalidateQueries({ queryKey: ['shopping-items'] })

  const createMut = useMutation({ mutationFn: shoppingApi.createItem,                                    onSuccess: () => { invalidateItems(); setModal(null) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }) => shoppingApi.updateItem(id, data),        onSuccess: () => { invalidateItems(); setModal(null) } })
  const deleteMut = useMutation({ mutationFn: shoppingApi.deleteItem,                                    onSuccess: () => { invalidateItems(); setModal(null) } })
  const toggleMut = useMutation({ mutationFn: ({ id, data }) => shoppingApi.updateItem(id, data),        onSuccess: invalidateItems })
  const clearMut  = useMutation({ mutationFn: shoppingApi.deleteCompleted,                               onSuccess: invalidateItems })

  const createStapleMut = useMutation({
    mutationFn: shoppingApi.createStaple,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staples'] }); setModal(null) },
  })
  const updateStapleMut = useMutation({
    mutationFn: ({ id, data }) => shoppingApi.updateStaple(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staples'] }); setModal(null) },
  })
  const deleteStapleMut = useMutation({
    mutationFn: shoppingApi.deleteStaple,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staples'] }); setModal(null) },
  })

  const openItemModal   = (item = null, opts = {}) => {
    setEditTarget(item)
    setAutoLookup(opts.autoLookup ?? false)
    setModal('item')
  }
  const openStapleModal = (staple = null) => { setEditTarget(staple); setModal('staple') }

  function handleScan(upc) {
    setScanning(false)
    openItemModal({ upc }, { autoLookup: true })
  }

  const handleItemSave = (form) => {
    if (editTarget?.id) updateMut.mutate({ id: editTarget.id, data: form })
    else createMut.mutate(form)
  }

  const handleStapleSave = (form) => {
    if (editTarget?.id) updateStapleMut.mutate({ id: editTarget.id, data: form })
    else createStapleMut.mutate(form)
  }

  // Build grouped sections: [{ storeLabel, depts: { deptKey: [items] } }]
  const grouped = useMemo(() => {
    const storeFiltered =
      selectedStore === 'all'  ? items :
      selectedStore === 'none' ? items.filter(i => !i.store_id) :
      items.filter(i => i.store_id === Number(selectedStore))

    const sortDepts = (map) =>
      Object.entries(map).sort(([a], [b]) => {
        if (a === '') return 1
        if (b === '') return -1
        return a.localeCompare(b)
      })

    if (selectedStore !== 'all') {
      const map = {}
      storeFiltered.forEach(item => {
        const k = item.department_name ?? ''
        ;(map[k] ??= []).push(item)
      })
      return [{ storeLabel: null, depts: sortDepts(map) }]
    }

    // Group by store → dept
    const storeMap = {}
    storeFiltered.forEach(item => {
      const sk = item.store_name ?? '__none__'
      if (!storeMap[sk]) storeMap[sk] = {}
      const dk = item.department_name ?? ''
      ;(storeMap[sk][dk] ??= []).push(item)
    })

    return Object.entries(storeMap)
      .sort(([a], [b]) => {
        if (a === '__none__') return 1
        if (b === '__none__') return -1
        return a.localeCompare(b)
      })
      .map(([sk, deptMap]) => ({
        storeLabel: sk === '__none__' ? 'No Store' : sk,
        depts: sortDepts(deptMap),
      }))
  }, [items, selectedStore])

  const grandTotal = useMemo(() => items.reduce((acc, i) => acc + lineTotal(i), 0), [items])

  const storeTotal = useMemo(() => {
    if (selectedStore === 'all') return null
    const filtered = selectedStore === 'none'
      ? items.filter(i => !i.store_id)
      : items.filter(i => i.store_id === Number(selectedStore))
    return filtered.reduce((acc, i) => acc + lineTotal(i), 0)
  }, [items, selectedStore])

  const hasCompleted = items.some(i => i.completed)
  const storeName = stores.find(s => String(s.id) === selectedStore)?.name

  return (
    <div className="flex flex-col h-full bg-warm-100">
      {/* Header */}
      <div className="bg-white border-b border-warm-200 shrink-0 safe-top">
        <div className="flex items-center justify-between px-4" style={{ height: 52 }}>
          <button
            onClick={onMenu}
            className="p-2 -ml-2 text-warm-500 active:bg-warm-100 rounded-xl"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-1.5">
            <ShoppingBagIcon className="w-4 h-4 text-warm-500" />
            <span className="text-base font-semibold text-warm-700">Shopping</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowStaples(true)}
              className="p-2 text-warm-400 active:bg-warm-100 rounded-xl"
              title="Staples"
            >
              <BookmarkIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setScanning(true)}
              className="p-2 text-warm-400 active:bg-warm-100 rounded-xl"
              title="Scan barcode"
            >
              <QrCodeIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => openItemModal()}
              className="p-2 text-white bg-warm-500 active:bg-warm-600 rounded-xl"
              title="Add item"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Store selector */}
      <div className="flex gap-2 px-4 py-2.5 bg-white border-b border-warm-200 overflow-x-auto shrink-0 scrollbar-hide">
        {[
          { id: 'all', label: 'All Stores' },
          ...stores.map(s => ({ id: String(s.id), label: s.name + (s.is_default ? ' ★' : '') })),
          ...(items.some(i => !i.store_id) ? [{ id: 'none', label: 'No Store' }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedStore(tab.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
              selectedStore === tab.id
                ? 'bg-warm-500 text-white'
                : 'bg-warm-100 text-warm-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-warm-300 gap-3 pb-16">
            <ShoppingBagIcon className="w-14 h-14 opacity-20" />
            <p className="text-sm">Your list is empty.</p>
            <button onClick={() => openItemModal()} className="text-sm text-warm-500 font-medium">
              Add the first item
            </button>
          </div>
        ) : (
          grouped.map((storeGroup, si) => (
            <div key={si}>
              {storeGroup.storeLabel && (
                <div className="px-4 py-2 bg-warm-50 border-b border-warm-200 sticky top-0 z-10">
                  <span className="text-xs font-bold text-warm-500 uppercase tracking-wider">
                    {storeGroup.storeLabel}
                  </span>
                </div>
              )}
              {storeGroup.depts.map(([deptKey, deptItems]) => (
                <div key={deptKey}>
                  <div className="px-4 py-1.5 bg-warm-100 border-b border-warm-200">
                    <span className="text-[11px] font-semibold text-warm-400 uppercase tracking-wider">
                      {deptKey || 'No Department'}
                    </span>
                  </div>
                  {deptItems.map(item => (
                    <MobileItemRow
                      key={item.id}
                      item={item}
                      onToggle={(i) => toggleMut.mutate({ id: i.id, data: { completed: !i.completed } })}
                      onEdit={openItemModal}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 bg-white border-t border-warm-200 safe-bottom">
      <div className="px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => { if (hasCompleted && confirm('Delete all completed items?')) clearMut.mutate() }}
          disabled={!hasCompleted}
          className="flex items-center gap-1.5 text-sm text-warm-300 disabled:opacity-30 active:text-red-500"
        >
          <TrashIcon className="w-4 h-4" />
          Clear done
        </button>
        <div className="text-sm text-right">
          {storeTotal != null && storeName && (
            <div className="text-xs text-warm-400">
              {storeName}: <span className="font-semibold text-warm-700">${fmt(storeTotal)}</span>
            </div>
          )}
          <div className="text-warm-700">
            Total: <span className="font-bold text-warm-700">${fmt(grandTotal)}</span>
          </div>
        </div>
      </div>
      </div>

      {/* Barcode scanner overlay */}
      {scanning && (
        <MobileBarcodeScanner
          onScan={handleScan}
          onClose={() => setScanning(false)}
        />
      )}

      {/* Modals */}
      {modal === 'item' && (
        <ItemModal
          item={editTarget}
          autoLookup={autoLookup}
          stores={stores}
          departments={departments}
          onSave={handleItemSave}
          onDelete={editTarget ? (id) => deleteMut.mutate(id) : null}
          onClose={() => { setModal(null); setAutoLookup(false) }}
        />
      )}
      {modal === 'staple' && (
        <ItemModal
          item={editTarget}
          stores={stores}
          departments={departments}
          onSave={handleStapleSave}
          onDelete={editTarget ? (id) => { deleteStapleMut.mutate(id); setModal(null) } : null}
          onClose={() => setModal(null)}
        />
      )}
      {showStaples && (
        <StaplesDrawer
          staples={staples}
          stores={stores}
          departments={departments}
          onEdit={(s) => { setShowStaples(false); openStapleModal(s) }}
          onClose={() => setShowStaples(false)}
        />
      )}
    </div>
  )
}
