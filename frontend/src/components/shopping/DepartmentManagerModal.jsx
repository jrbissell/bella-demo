import { useState } from 'react'
import { XMarkIcon, PencilIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { shoppingApi } from '../../api/shopping'

export default function DepartmentManagerModal({ departments, onClose }) {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['departments'] })

  const createMut = useMutation({ mutationFn: shoppingApi.createDept, onSuccess: invalidate })
  const updateMut = useMutation({ mutationFn: ({ id, data }) => shoppingApi.updateDept(id, data), onSuccess: invalidate })
  const deleteMut = useMutation({ mutationFn: shoppingApi.deleteDept, onSuccess: invalidate })

  const handleAdd = (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    createMut.mutate({ name: newName.trim() })
    setNewName('')
  }

  const handleRename = (e) => {
    e.preventDefault()
    if (!editing?.name.trim()) return
    updateMut.mutate({ id: editing.id, data: { name: editing.name.trim() } })
    setEditing(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">Manage Departments</h2>
          <button onClick={onClose} className="text-warm-300 hover:text-warm-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 space-y-1 max-h-72 overflow-y-auto">
          {departments.length === 0 && (
            <p className="text-sm text-warm-300 text-center py-4">No departments yet</p>
          )}
          {departments.map(dept => (
            <div key={dept.id} className="flex items-center gap-2 group py-1">
              {editing?.id === dept.id ? (
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
                  <span className="flex-1 text-sm text-warm-700">{dept.name}</span>
                  <button
                    onClick={() => setEditing({ id: dept.id, name: dept.name })}
                    className="opacity-0 group-hover:opacity-100 text-warm-300 hover:text-warm-400 transition-opacity"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${dept.name}"?`)) deleteMut.mutate(dept.id) }}
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
            placeholder="New department name…"
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
