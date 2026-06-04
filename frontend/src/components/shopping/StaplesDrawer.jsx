import { XMarkIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { shoppingApi } from '../../api/shopping'

function fmtPrice(staple) {
  if (!staple.price_per_unit) return null
  return `$${(staple.price_per_unit * staple.quantity).toFixed(2)}`
}

export default function StaplesDrawer({ staples, stores, departments, onEdit, onClose }) {
  const qc = useQueryClient()
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['staples'] })
    qc.invalidateQueries({ queryKey: ['shopping-items'] })
  }

  const addMut    = useMutation({ mutationFn: shoppingApi.addToList,   onSuccess: invalidateAll })
  const deleteMut = useMutation({ mutationFn: shoppingApi.deleteStaple, onSuccess: () => qc.invalidateQueries({ queryKey: ['staples'] }) })

  // Group staples by department name (alphabetical), then "No Department"
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
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200 shrink-0">
          <h2 className="text-base font-semibold text-warm-700">Staples</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(null)}
              className="flex items-center gap-1 text-xs text-warm-500 hover:text-warm-600 font-medium"
            >
              <PlusIcon className="w-4 h-4" /> New Staple
            </button>
            <button onClick={onClose} className="text-warm-300 hover:text-warm-400 ml-2">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {staples.length === 0 && (
            <p className="text-sm text-warm-300 text-center py-8">
              No staples yet.<br />Archive a shopping item to save it here.
            </p>
          )}
          {deptKeys.map(deptKey => (
            <div key={deptKey}>
              <p className="text-xs font-semibold text-warm-300 uppercase tracking-wide mb-1">{deptKey}</p>
              <div className="space-y-1">
                {grouped[deptKey].sort((a,b) => a.description.localeCompare(b.description)).map(staple => (
                  <div key={staple.id} className="flex items-center gap-2 group py-1.5 px-2 rounded-lg hover:bg-warm-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-warm-700 truncate">
                        {staple.brand ? <span className="text-warm-300 mr-1">{staple.brand}</span> : null}
                        {staple.description}
                      </p>
                      <p className="text-xs text-warm-300">
                        Qty: {staple.quantity} · Size: {staple.unit}
                        {staple.store_name ? ` · ${staple.store_name}` : ''}
                        {fmtPrice(staple) ? ` · ${fmtPrice(staple)}` : ''}
                        {staple.taxable ? ' · taxable' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(staple)}
                        className="p-1 text-warm-300 hover:text-warm-400 rounded"
                        title="Edit staple"
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete "${staple.description}"?`)) deleteMut.mutate(staple.id) }}
                        className="p-1 text-warm-300 hover:text-red-500 rounded"
                        title="Delete staple"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => addMut.mutate(staple.id)}
                        className="p-1 text-warm-500 hover:text-warm-600 rounded"
                        title="Add to shopping list"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
