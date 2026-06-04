import { useState, useMemo, useEffect } from 'react'
import MobileShoppingPage from './MobileShoppingPage'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, TrashIcon, BookmarkIcon, ShoppingBagIcon, BuildingStorefrontIcon, TagIcon, PencilIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'
import { shoppingApi } from '../api/shopping'
import ItemModal from '../components/shopping/ItemModal'
import StoreManagerModal from '../components/shopping/StoreManagerModal'
import DepartmentManagerModal from '../components/shopping/DepartmentManagerModal'
import PriceCompareModal from '../components/shopping/PriceCompareModal'


// ── helpers ──────────────────────────────────────────────────────────────────

function lineTotal(item) {
  if (!item.price_per_unit) return 0
  const base = item.price_per_unit * item.quantity
  return item.taxable ? base * (1 + item.tax_rate / 100) : base
}

function fmt(n) { return n.toFixed(2) }


// ── shopping item row ─────────────────────────────────────────────────────────

function ItemRow({ item, onToggle, onEdit, onArchive, onCheckPrices }) {
  const total = lineTotal(item)
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-warm-100 ${item.completed ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={item.completed}
        onChange={() => onToggle(item)}
        className="w-4 h-4 rounded accent-warm-500 border-warm-200 shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          {item.brand && <span className="text-xs text-warm-300 shrink-0">{item.brand}</span>}
          <span className={`text-sm font-medium text-warm-700 truncate ${item.completed ? 'line-through' : ''}`}>
            {item.description}
          </span>
          {item.taxable && (
            <span className="shrink-0 text-[10px] font-semibold text-honey-600 bg-honey-100 border border-honey-500/30 rounded px-1">TAX</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-warm-300 mt-0.5">
          <span style={{ whiteSpace: 'pre' }}>{`Qty:${item.quantity}   Size:${item.unit || '—'}`}</span>
          {item.price_per_unit && <span>@ ${fmt(item.price_per_unit)}</span>}
          {item.notes && <span className="truncate italic">"{item.notes}"</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="w-16 text-right text-sm font-semibold text-sage-500">
          {total > 0 ? `$${fmt(total)}` : ''}
        </span>
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.upc && (
            <button onClick={() => onCheckPrices(item)} title="Check store prices" className="p-1 text-warm-300 hover:text-sage-500 rounded">
              <CurrencyDollarIcon className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onArchive(item)} title="Save as staple" className="p-1 text-warm-300 hover:text-honey-500 rounded">
            <BookmarkIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onEdit(item)} title="Edit" className="p-1 text-warm-300 hover:text-warm-500 rounded">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}


// ── staples panel ─────────────────────────────────────────────────────────────

function StaplesPanel({ staples, onEdit, onAddToList, onDelete }) {
  const [confirmId, setConfirmId] = useState(null)

  const grouped = {}
  staples.forEach(s => {
    const key = s.department_name ?? '— No Department —'
    ;(grouped[key] ??= []).push(s)
  })
  const deptKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '— No Department —') return 1
    if (b === '— No Department —') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-warm-200 shrink-0">
        <div className="flex items-center gap-1.5">
          <BookmarkIcon className="w-4 h-4 text-warm-500" />
          <span className="text-sm font-semibold text-warm-700">Staples</span>
        </div>
        <button
          onClick={() => onEdit(null)}
          className="flex items-center gap-1 text-xs text-warm-500 hover:text-warm-600 font-medium"
        >
          <PlusIcon className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {/* Staples list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {staples.length === 0 && (
          <p className="text-xs text-warm-300 text-center py-8">
            No staples yet.<br />Archive a shopping item to save it here.
          </p>
        )}
        {deptKeys.map(deptKey => (
          <div key={deptKey}>
            <p className="text-[10px] font-semibold text-warm-300 uppercase tracking-wide mb-1 px-1">{deptKey}</p>
            <div className="space-y-0.5">
              {grouped[deptKey]
                .sort((a, b) => a.description.localeCompare(b.description))
                .map(staple => (
                  <div key={staple.id} className="flex items-center gap-1.5 group py-1.5 px-2 rounded-lg hover:bg-warm-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-warm-700 truncate">
                        {staple.brand && <span className="text-warm-300 mr-1">{staple.brand}</span>}
                        {staple.description}
                      </p>
                      <p className="text-[10px] text-warm-300">
                        {`Qty:${staple.quantity}   Size:${staple.unit || '—'}`}
                        {staple.store_name ? ` · ${staple.store_name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => onEdit(staple)} title="Edit" className="p-1 text-warm-300 hover:text-warm-400 rounded">
                        <PencilIcon className="w-3 h-3" />
                      </button>
                      {confirmId === staple.id ? (
                        <>
                          <button
                            onClick={() => { onDelete(staple.id); setConfirmId(null) }}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="px-1.5 py-0.5 text-[10px] font-medium text-warm-400 hover:text-warm-600 rounded transition-colors"
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmId(staple.id)}
                          title="Delete"
                          className="p-1 text-warm-300 hover:text-red-500 rounded"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      )}
                      <button onClick={() => onAddToList(staple.id)} title="Add to list" className="p-1 text-warm-500 hover:text-warm-600 rounded">
                        <PlusIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ── main page ─────────────────────────────────────────────────────────────────

export default function ShoppingPage() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileShoppingPage />

  const qc = useQueryClient()
  const [selectedStore, setSelectedStore] = useState('all')
  const [modal, setModal]           = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [priceItem, setPriceItem]   = useState(null)

  const { data: stores      = [] } = useQuery({ queryKey: ['stores'],         queryFn: shoppingApi.listStores })
  const { data: departments = [] } = useQuery({ queryKey: ['departments'],    queryFn: shoppingApi.listDepts })
  const { data: items       = [] } = useQuery({ queryKey: ['shopping-items'], queryFn: shoppingApi.listItems })
  const { data: staples     = [] } = useQuery({ queryKey: ['staples'],        queryFn: shoppingApi.listStaples })

  const invalidateItems   = () => qc.invalidateQueries({ queryKey: ['shopping-items'] })
  const invalidateStaples = () => qc.invalidateQueries({ queryKey: ['staples'] })
  const invalidateBoth    = () => { invalidateItems(); invalidateStaples() }

  const createMut      = useMutation({ mutationFn: shoppingApi.createItem,     onSuccess: () => { invalidateItems(); setModal(null) } })
  const updateMut      = useMutation({ mutationFn: ({ id, data }) => shoppingApi.updateItem(id, data), onSuccess: () => { invalidateItems(); setModal(null) } })
  const deleteMut      = useMutation({ mutationFn: shoppingApi.deleteItem,     onSuccess: invalidateItems })
  const toggleMut      = useMutation({ mutationFn: ({ id, data }) => shoppingApi.updateItem(id, data), onSuccess: invalidateItems })
  const clearMut       = useMutation({ mutationFn: shoppingApi.deleteCompleted, onSuccess: invalidateItems })
  const archiveMut     = useMutation({ mutationFn: shoppingApi.archiveItem,    onSuccess: invalidateStaples })
  const addToListMut   = useMutation({ mutationFn: shoppingApi.addToList,      onSuccess: invalidateBoth })
  const deleteStapleMut = useMutation({ mutationFn: shoppingApi.deleteStaple,  onSuccess: invalidateStaples })
  const createStapleMut = useMutation({ mutationFn: shoppingApi.createStaple,  onSuccess: () => { invalidateStaples(); setModal(null) } })
  const updateStapleMut = useMutation({ mutationFn: ({ id, data }) => shoppingApi.updateStaple(id, data), onSuccess: () => { invalidateStaples(); setModal(null) } })

  const storeFilteredItems = useMemo(() => {
    if (selectedStore === 'all') return items
    if (selectedStore === 'none') return items.filter(i => !i.store_id)
    return items.filter(i => i.store_id === Number(selectedStore))
  }, [items, selectedStore])

  const grouped = useMemo(() => {
    const map = {}
    storeFilteredItems.forEach(item => {
      const key = item.department_name ?? ''
      ;(map[key] ??= []).push(item)
    })
    return map
  }, [storeFilteredItems])

  const deptKeys = useMemo(() =>
    Object.keys(grouped).sort((a, b) => {
      if (a === '') return 1
      if (b === '') return -1
      return a.localeCompare(b)
    }), [grouped])

  const totals = useMemo(() => {
    const byStore = {}
    items.forEach(item => {
      const key = item.store_id ?? 'none'
      byStore[key] = (byStore[key] ?? 0) + lineTotal(item)
    })
    return {
      byStore,
      grand:    Object.values(byStore).reduce((a, b) => a + b, 0),
      selected: storeFilteredItems.reduce((acc, i) => acc + lineTotal(i), 0),
    }
  }, [items, storeFilteredItems])

  const hasCompleted = items.some(i => i.completed)

  const openItemModal   = (item = null)   => { setEditTarget(item);   setModal('item') }
  const openStapleModal = (staple = null) => { setEditTarget(staple); setModal('staple') }

  const handleItemSave = (form) => {
    if (editTarget?.id) updateMut.mutate({ id: editTarget.id, data: form })
    else createMut.mutate(form)
  }
  const handleStapleSave = (form) => {
    if (editTarget?.id) updateStapleMut.mutate({ id: editTarget.id, data: form })
    else createStapleMut.mutate(form)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-warm-100">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-warm-200 shrink-0">
        <div className="flex items-center gap-1.5">
          <ShoppingBagIcon className="w-4 h-4 text-warm-500" />
          <span className="text-sm font-semibold text-warm-700">Shopping List</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModal('dept')} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-warm-400 hover:text-warm-600 bg-warm-100 hover:bg-warm-50 border border-warm-200 rounded-lg transition-colors">
            <TagIcon className="w-3.5 h-3.5" /> Depts
          </button>
          <button onClick={() => setModal('store')} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-warm-400 hover:text-warm-600 bg-warm-100 hover:bg-warm-50 border border-warm-200 rounded-lg transition-colors">
            <BuildingStorefrontIcon className="w-3.5 h-3.5" /> Stores
          </button>
          <button onClick={() => openItemModal()} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-warm-500 hover:bg-warm-50 rounded-lg transition-colors">
            <PlusIcon className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Shopping list */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* Store tabs */}
          <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-warm-200 overflow-x-auto shrink-0">
            {[
              { id: 'all', label: 'All Stores' },
              ...stores.map(s => ({ id: String(s.id), label: s.name + (s.is_default ? ' ★' : '') })),
              ...(items.some(i => !i.store_id) ? [{ id: 'none', label: 'No Store' }] : []),
            ].map(tab => {
              const storeTotal = tab.id === 'all'
                ? totals.grand
                : tab.id === 'none'
                  ? items.filter(i => !i.store_id).reduce((a, i) => a + lineTotal(i), 0)
                  : (totals.byStore[Number(tab.id)] ?? 0)
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedStore(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedStore === tab.id ? 'bg-warm-50 text-warm-500' : 'text-warm-400 hover:text-warm-700 hover:bg-warm-100'
                  }`}
                >
                  {tab.label}
                  {storeTotal > 0 && <span className="text-[10px] opacity-70">${fmt(storeTotal)}</span>}
                </button>
              )
            })}
          </div>

          {/* Item list */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {storeFilteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-warm-300 gap-2">
                <ShoppingBagIcon className="w-10 h-10 opacity-30" />
                <p className="text-sm">No items{selectedStore !== 'all' ? ' for this store' : ''}.</p>
                <button onClick={() => openItemModal()} className="text-sm text-warm-500 hover:underline">Add the first one</button>
              </div>
            ) : (
              <div className="divide-y divide-warm-200">
                {deptKeys.map(deptKey => (
                  <div key={deptKey}>
                    <div className="px-4 py-1.5 bg-warm-100 border-b border-warm-200">
                      <span className="text-[11px] font-semibold text-warm-300 uppercase tracking-wide">
                        {deptKey || 'No Department'}
                      </span>
                    </div>
                    {grouped[deptKey].map(item => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onToggle={(i) => toggleMut.mutate({ id: i.id, data: { completed: !i.completed } })}
                        onEdit={openItemModal}
                        onArchive={(i) => archiveMut.mutate(i.id)}
                        onCheckPrices={setPriceItem}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total bar */}
          <div className="shrink-0 bg-white border-t border-warm-200 px-4 py-2 flex items-center justify-between gap-4">
            <button
              onClick={() => { if (hasCompleted && confirm('Delete all completed items?')) clearMut.mutate() }}
              disabled={!hasCompleted}
              className="flex items-center gap-1 text-xs text-warm-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <TrashIcon className="w-3.5 h-3.5" /> Delete completed
            </button>
            <div className="flex items-center gap-4 text-sm">
              {selectedStore !== 'all' && (
                <span className="text-warm-400">
                  {stores.find(s => String(s.id) === selectedStore)?.name ?? 'No Store'}:{' '}
                  <span className="font-semibold text-warm-700">${fmt(totals.selected)}</span>
                </span>
              )}
              <span className="text-warm-400">
                Total: <span className="font-semibold text-warm-700">${fmt(totals.grand)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-warm-200 shrink-0" />

        {/* RIGHT: Staples */}
        <div className="w-72 shrink-0 bg-white flex flex-col min-h-0">
          <StaplesPanel
            staples={staples}
            onEdit={openStapleModal}
            onAddToList={(id) => addToListMut.mutate(id)}
            onDelete={(id) => deleteStapleMut.mutate(id)}
          />
        </div>
      </div>

      {/* Modals */}
      {modal === 'item' && (
        <ItemModal
          item={editTarget}
          stores={stores}
          departments={departments}
          onSave={handleItemSave}
          onDelete={(id) => { deleteMut.mutate(id); setModal(null) }}
          onClose={() => setModal(null)}
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
      {modal === 'store' && <StoreManagerModal stores={stores} onClose={() => setModal(null)} />}
      {modal === 'dept'  && <DepartmentManagerModal departments={departments} onClose={() => setModal(null)} />}

      {priceItem && (
        <PriceCompareModal
          upc={priceItem.upc}
          stores={stores}
          onSelect={(price, storeId) => {
            const data = { price_per_unit: price }
            if (storeId != null) data.store_id = storeId
            updateMut.mutate({ id: priceItem.id, data })
            setPriceItem(null)
          }}
          onClose={() => setPriceItem(null)}
        />
      )}
    </div>
  )
}
