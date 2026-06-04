import { useState } from 'react'
import { XMarkIcon, PencilIcon, TrashIcon, StarIcon, CheckIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { shoppingApi } from '../../api/shopping'

export default function StoreManagerModal({ stores, onClose }) {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState(null) // { id, name }

  const invalidate = () => qc.invalidateQueries({ queryKey: ['stores'] })

  const createMut = useMutation({ mutationFn: shoppingApi.createStore, onSuccess: invalidate })
  const updateMut = useMutation({ mutationFn: ({ id, data }) => shoppingApi.updateStore(id, data), onSuccess: invalidate })
  const deleteMut = useMutation({ mutationFn: shoppingApi.deleteStore, onSuccess: invalidate })

  const handleAdd = (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    createMut.mutate({ name: newName.trim(), is_default: stores.length === 0 })
    setNewName('')
  }

  const handleRename = (e) => {
    e.preventDefault()
    if (!editing?.name.trim()) return
    updateMut.mutate({ id: editing.id, data: { name: editing.name.trim() } })
    setEditing(null)
  }

  const setDefault = (id) => {
    updateMut.mutate({ id, data: { is_default: true } })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">Manage Stores</h2>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 space-y-1 max-h-72 overflow-y-auto">
          {stores.length === 0 && (
            <p className="text-sm text-warm-300 text-center py-4">No stores yet</p>
          )}
          {stores.map(store => (
            <div key={store.id} className="flex items-center gap-2 group py-1">
              {editing?.id === store.id ? (
                <form onSubmit={handleRename} className="flex-1 flex gap-2">
                  <input
                    autoFocus
                    value={editing.name}
                    onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))}
                    className="flex-1 text-sm border border-warm-200 rounded px-2 py-1 focus:outline-none"
                  />
                  <button type="submit" className="text-warm-500 hover:text-warm-600">
                    <CheckIcon className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="text-warm-300 hover:text-warm-400">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <>
                  <button
                    onClick={() => setDefault(store.id)}
                    title={store.is_default ? 'Default store' : 'Set as default'}
                    className="shrink-0"
                  >
                    {store.is_default
                      ? <StarSolid className="w-4 h-4 text-amber-400" />
                      : <StarIcon className="w-4 h-4 text-warm-300 hover:text-amber-300" />}
                  </button>
                  <span className="flex-1 text-sm text-warm-700">{store.name}</span>
                  <button
                    onClick={() => setEditing({ id: store.id, name: store.name })}
                    className="opacity-0 group-hover:opacity-100 text-warm-300 hover:text-warm-400 transition-opacity"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${store.name}"?`)) deleteMut.mutate(store.id) }}
                    className="opacity-0 group-hover:opacity-100 text-warm-300 hover:text-red-500 transition-opacity"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="px-5 py-4 border-t border-warm-200 flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New store name…"
            className="flex-1 text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="px-3 py-2 text-sm font-medium bg-warm-500 text-white rounded-lg hover:bg-warm-50 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  )
}
