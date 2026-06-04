import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, XMarkIcon, PencilIcon, TrashIcon, CheckIcon, Bars3Icon } from '@heroicons/react/24/outline'
import { routinesApi, activeTypes, itemScheduledToday, parseDays, serializeDays } from '../api/routines'
import { familyApi } from '../api/family'

const TODAY = new Date().toISOString().slice(0, 10)

const TYPES = [
  { id: 'morning', label: 'Morning', emoji: '☀️' },
  { id: 'evening', label: 'Evening', emoji: '🌙' },
  { id: 'daily',   label: 'Daily',   emoji: '🔄' },
]

const DAY_LABELS  = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAY_FULL    = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function getInitials(name) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function scheduleLabel(schedule) {
  const days = parseDays(schedule)
  if (days.length === 7) return 'Every day'
  if (JSON.stringify(days) === JSON.stringify([1,2,3,4,5])) return 'Weekdays'
  if (JSON.stringify(days) === JSON.stringify([0,6])) return 'Weekends'
  if (days.length <= 3) return days.map(d => DAY_LABELS[d]).join(' ')
  return `${days.length} days`
}

// ── Day Picker ────────────────────────────────────────────────────────────────

function DayPicker({ value, onChange }) {
  const selected = parseDays(value)
  const toggle = (day) => {
    const next = selected.includes(day)
      ? selected.filter(d => d !== day)
      : [...selected, day]
    if (next.length === 0) return  // must keep at least 1 day
    onChange(serializeDays(next))
  }
  return (
    <div className="flex gap-1 py-1.5 px-1">
      {DAY_LABELS.map((lbl, i) => (
        <button key={i} type="button" onClick={() => toggle(i)}
          title={DAY_FULL[i]}
          className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
            selected.includes(i)
              ? 'bg-indigo-500 text-white'
              : 'bg-warm-100 text-warm-400 hover:bg-warm-200'
          }`}>
          {lbl}
        </button>
      ))}
    </div>
  )
}

// ── Routine Modal ─────────────────────────────────────────────────────────────

function RoutineModal({ item, members, onSave, onClose }) {
  const [form, setForm] = useState({
    name:             item?.name             ?? '',
    routine_type:     item?.routine_type     ?? 'morning',
    family_member_id: item?.family_member_id ?? '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim()) return
    onSave({
      name:             form.name.trim(),
      routine_type:     form.routine_type,
      family_member_id: form.family_member_id ? Number(form.family_member_id) : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-700">{item?.id ? 'Edit Routine' : 'New Routine'}</h2>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-warm-300 hover:text-warm-500" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Name *</label>
            <input autoFocus value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Dad's Morning Routine" />
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map(t => (
                <button key={t.id} type="button" onClick={() => set('routine_type', t.id)}
                  className={`py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                    form.routine_type === t.id
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-warm-200 text-warm-400 hover:border-warm-300'
                  }`}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-warm-400 mb-1">Assign to</label>
            <select value={form.family_member_id} onChange={e => set('family_member_id', e.target.value)}
              className="w-full text-sm border border-warm-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option value="">— Everyone / Unassigned —</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-warm-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim()}
            className="px-4 py-2 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40">
            {item?.id ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({ item, draggable, onDragStart, onDragOver, onDrop, onCheck, onDelete, onUpdateSchedule, onUpdateTitle }) {
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(item.title)
  const [dragOver, setDragOver] = useState(false)
  const days = parseDays(item.schedule)
  const isAll = days.length === 7

  const saveTitle = () => {
    const t = draft.trim()
    if (t && t !== item.title) onUpdateTitle(item.id, t)
    setEditing(false)
  }

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragOver={draggable ? e => { e.preventDefault(); setDragOver(true); onDragOver() } : undefined}
      onDragLeave={draggable ? () => setDragOver(false) : undefined}
      onDrop={draggable ? e => { e.preventDefault(); setDragOver(false); onDrop() } : undefined}
      className={`transition-colors rounded ${dragOver ? 'bg-indigo-50' : ''}`}
    >
      <div className="flex items-center gap-2 group py-1">
        {draggable && (
          <Bars3Icon className="w-3.5 h-3.5 text-warm-200 group-hover:text-warm-400 cursor-grab shrink-0" />
        )}

        <button onClick={() => onCheck(item)}
          className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
            item.completion_id
              ? 'bg-sage-400 border-sage-400'
              : 'border-warm-300 hover:border-sage-400 cursor-pointer'
          }`}>
          {item.completion_id && <CheckIcon className="w-3 h-3 text-white" />}
        </button>

        {editing ? (
          <input
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setDraft(item.title); setEditing(false) } }}
            className="flex-1 text-sm border-b border-indigo-300 bg-transparent outline-none text-warm-700 py-0.5"
          />
        ) : (
          <span
            onClick={() => { setDraft(item.title); setEditing(true) }}
            className={`flex-1 text-sm cursor-text ${item.completion_id ? 'line-through text-warm-300' : 'text-warm-700 hover:text-indigo-600'}`}
            title="Click to edit">
            {item.title}
          </span>
        )}

        <button onClick={() => setOpen(o => !o)}
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
            isAll ? 'text-warm-300 hover:bg-warm-100' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
          }`}
          title="Edit days">
          {scheduleLabel(item.schedule)}
        </button>

        <button onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-warm-300 hover:text-red-400 transition-all">
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className={`mb-1 bg-warm-50 rounded-lg border border-warm-200 ${draggable ? 'ml-12' : 'ml-7'}`}>
          <DayPicker value={item.schedule} onChange={val => onUpdateSchedule(item.id, val)} />
        </div>
      )}
    </div>
  )
}

// ── Routine Card ──────────────────────────────────────────────────────────────

function RoutineCard({ routine, member, filterToday, onEdit, onDelete, onCheck, onAddItem, onDeleteItem, onUpdateItemSchedule, onUpdateItemTitle, onReorderItems }) {
  const [newTask, setNewTask]   = useState('')
  const [newDays, setNewDays]   = useState('daily')
  const [showNewPicker, setShowNewPicker] = useState(false)
  const [dragSrcId, setDragSrcId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const inputRef = useRef(null)

  const items   = filterToday ? routine.items.filter(itemScheduledToday) : routine.items
  const total   = items.length
  const done    = items.filter(i => i.completion_id).length
  const allDone = total > 0 && done === total

  const handleAddTask = () => {
    const t = newTask.trim()
    if (!t) return
    onAddItem(routine.id, t, newDays)
    setNewTask('')
    setNewDays('daily')
    setShowNewPicker(false)
    inputRef.current?.focus()
  }

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${allDone ? 'border-sage-200' : 'border-warm-200'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-warm-100"
        style={{ borderLeftWidth: 3, borderLeftColor: member?.color ?? '#d1c9be' }}>
        {member ? (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: member.color }}>
            {getInitials(member.name)}
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-warm-100 flex items-center justify-center text-warm-400 text-xs shrink-0">All</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-warm-700 truncate">{routine.name}</p>
          <p className={`text-xs ${allDone ? 'text-sage-500 font-medium' : 'text-warm-400'}`}>
            {allDone ? '✓ All done' : total > 0 ? `${done} / ${total}` : 'No tasks today'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(routine)} className="p-1 text-warm-300 hover:text-indigo-500 transition-colors">
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(routine)} className="p-1 text-warm-300 hover:text-red-400 transition-colors">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tasks */}
      <div className="px-4 py-2">
        {items.length === 0 && (
          <p className="text-xs text-warm-300 py-2 text-center italic">No tasks scheduled today</p>
        )}
        {items.map(item => (
          <TaskRow
            key={item.id}
            item={item}
            draggable={!filterToday}
            onDragStart={() => setDragSrcId(item.id)}
            onDragOver={() => setDragOverId(item.id)}
            onDrop={() => {
              if (!dragSrcId || dragSrcId === item.id) return
              const ids = routine.items.map(i => i.id)
              const from = ids.indexOf(dragSrcId)
              const to   = ids.indexOf(item.id)
              ids.splice(from, 1)
              ids.splice(to, 0, dragSrcId)
              onReorderItems(routine.id, ids)
              setDragSrcId(null); setDragOverId(null)
            }}
            onCheck={onCheck}
            onDelete={onDeleteItem}
            onUpdateSchedule={(id, val) => onUpdateItemSchedule(id, val)}
            onUpdateTitle={(id, title) => onUpdateItemTitle(id, title)}
          />
        ))}

        {/* Add new task */}
        <div className="pt-1.5 border-t border-warm-50 mt-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 shrink-0" />
            <input
              ref={inputRef}
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddTask() }}
              onFocus={() => setShowNewPicker(true)}
              placeholder="Add task…"
              className="flex-1 text-xs text-warm-500 placeholder-warm-300 bg-transparent border-none outline-none"
            />
            {/* Days summary for new task */}
            <button onClick={() => setShowNewPicker(o => !o)}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                parseDays(newDays).length === 7
                  ? 'text-warm-300 hover:bg-warm-100'
                  : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
              }`}>
              {scheduleLabel(newDays)}
            </button>
            {newTask.trim() && (
              <button onClick={handleAddTask} className="p-0.5 text-sage-500 hover:text-sage-700">
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Day picker for new task */}
          {showNewPicker && (
            <div className="ml-7 mt-1 bg-warm-50 rounded-lg border border-warm-200">
              <DayPicker value={newDays} onChange={setNewDays} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RoutinesPage() {
  const qc = useQueryClient()
  const [modal, setModal]       = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [editMode, setEditMode] = useState(false)

  const { data: routines = [] } = useQuery({
    queryKey: ['routines', TODAY],
    queryFn:  () => routinesApi.list(TODAY),
  })
  const { data: members = [] } = useQuery({
    queryKey: ['family-members'],
    queryFn:  familyApi.list,
  })

  const inv = () => qc.invalidateQueries({ queryKey: ['routines'] })

  const createMut     = useMutation({ mutationFn: routinesApi.create, onSuccess: () => { inv(); setModal(null) } })
  const updateMut     = useMutation({ mutationFn: ({ id, data }) => routinesApi.update(id, data), onSuccess: () => { inv(); setModal(null) } })
  const deleteMut     = useMutation({ mutationFn: routinesApi.delete, onSuccess: () => { inv(); setDeleting(null) } })
  const addItemMut    = useMutation({ mutationFn: ({ id, title, schedule }) => routinesApi.addItem(id, title, schedule), onSuccess: inv })
  const delItemMut    = useMutation({ mutationFn: routinesApi.deleteItem, onSuccess: inv })
  const updateItemMut = useMutation({ mutationFn: ({ id, data }) => routinesApi.updateItem(id, data), onSuccess: inv })
  const reorderMut    = useMutation({ mutationFn: ({ routineId, ids }) => routinesApi.reorderItems(routineId, ids), onSuccess: inv })
  const checkMut      = useMutation({ mutationFn: ({ item_id, date }) => routinesApi.markComplete(item_id, date), onSuccess: inv })
  const uncheckMut    = useMutation({ mutationFn: routinesApi.unmarkComplete, onSuccess: inv })

  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))
  const nowHour   = new Date().getHours()
  const showTypes = new Set(activeTypes())
  const label     = nowHour < 12 ? 'Morning' : 'Evening'
  const visible   = editMode
    ? routines   // all routines in edit mode
    : routines.filter(r => showTypes.has(r.routine_type))

  const handleCheck = (item) => {
    if (item.completion_id) uncheckMut.mutate(item.completion_id)
    else checkMut.mutate({ item_id: item.id, date: TODAY })
  }

  const handleSave = (data) => {
    if (modal?.id) updateMut.mutate({ id: modal.id, data })
    else createMut.mutate(data)
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-warm-100">
      <div className="max-w-5xl mx-auto p-6">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-warm-700">
              {editMode ? '✏️ Edit Routines' : `${nowHour < 12 ? '☀️' : '🌙'} ${label} Routines`}
            </h1>
            <p className="text-xs text-warm-400 mt-0.5">
              {editMode
                ? 'All routines — tasks show all scheduled days'
                : `${new Date(TODAY + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · Daily routines always shown`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditMode(e => !e)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors border ${
                editMode
                  ? 'bg-warm-700 text-white border-warm-700 hover:bg-warm-800'
                  : 'bg-white text-warm-600 border-warm-200 hover:border-warm-400'
              }`}>
              {editMode ? '✓ Done' : '✏️ Edit'}
            </button>
            {editMode && (
              <button onClick={() => setModal({})}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
                <PlusIcon className="w-4 h-4" /> New Routine
              </button>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-warm-300">
            <p className="text-4xl mb-3">{nowHour < 12 ? '☀️' : '🌙'}</p>
            <p className="text-sm font-medium">No {label.toLowerCase()} or daily routines yet</p>
            <button onClick={() => { setEditMode(true); setModal({}) }}
              className="mt-3 text-sm text-indigo-500 hover:text-indigo-700 font-medium">+ Add one</button>
          </div>
        ) : editMode ? (
          /* Edit mode — grouped by type */
          <div className="space-y-8">
            {TYPES.map(type => {
              const group = visible.filter(r => r.routine_type === type.id)
              if (group.length === 0) return null
              return (
                <div key={type.id}>
                  <h2 className="text-sm font-semibold text-warm-500 uppercase tracking-wide mb-3">
                    {type.emoji} {type.label}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.map(routine => (
                      <RoutineCard
                        key={routine.id}
                        routine={routine}
                        member={memberMap[routine.family_member_id] ?? null}
                        filterToday={false}
                        onEdit={r => setModal(r)}
                        onDelete={r => setDeleting(r)}
                        onCheck={handleCheck}
                        onAddItem={(id, title, schedule) => addItemMut.mutate({ id, title, schedule })}
                        onDeleteItem={id => delItemMut.mutate(id)}
                        onUpdateItemSchedule={(id, val) => updateItemMut.mutate({ id, data: { schedule: val } })}
                        onUpdateItemTitle={(id, title) => updateItemMut.mutate({ id, data: { title } })}
                        onReorderItems={(routineId, ids) => reorderMut.mutate({ routineId, ids })}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Today view */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map(routine => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                member={memberMap[routine.family_member_id] ?? null}
                filterToday={true}
                onEdit={r => { setEditMode(true); setModal(r) }}
                onDelete={r => setDeleting(r)}
                onCheck={handleCheck}
                onAddItem={(id, title, schedule) => addItemMut.mutate({ id, title, schedule })}
                onDeleteItem={id => delItemMut.mutate(id)}
                onUpdateItemSchedule={(id, val) => updateItemMut.mutate({ id, data: { schedule: val } })}
              />
            ))}
          </div>
        )}
      </div>

      {modal !== null && (
        <RoutineModal
          item={modal?.id ? modal : null}
          members={members}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
            <p className="text-sm font-semibold text-warm-700 mb-1">Delete "{deleting.name}"?</p>
            <p className="text-xs text-warm-400 mb-4">All tasks and completion history will be removed.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 text-sm text-warm-400 hover:text-warm-700">Cancel</button>
              <button onClick={() => deleteMut.mutate(deleting.id)}
                className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
