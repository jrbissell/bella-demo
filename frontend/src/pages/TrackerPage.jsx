import { useState, useEffect, useCallback } from 'react'
import { ClipboardDocumentIcon, CheckIcon, PlusIcon } from '@heroicons/react/24/outline'
import { getTrackerItems, createTrackerItem, updateTrackerItem, deleteTrackerItem } from '../api/tracker'
import TrackerModal from '../components/tracker/TrackerModal'

// ── Display helpers ──────────────────────────────────────────────────────────

const TYPE_META = {
  bug:     { label: 'Bug',         bg: 'bg-red-100',    text: 'text-red-700' },
  feature: { label: 'New Feature', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  change:  { label: 'Change',      bg: 'bg-blue-100',   text: 'text-blue-700' },
  remove:  { label: 'Remove',      bg: 'bg-orange-100', text: 'text-orange-700' },
}

const PRIORITY_META = {
  1: { label: 'High',   bg: 'bg-red-50',    text: 'text-red-600' },
  5: { label: 'Med',    bg: 'bg-yellow-50', text: 'text-yellow-700' },
  9: { label: 'Low',    bg: 'bg-sky-50',    text: 'text-sky-600' },
}

function TypeBadge({ type }) {
  const m = TYPE_META[type] || { label: type, bg: 'bg-warm-100', text: 'text-warm-400' }
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority]
  if (!m) return null
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  )
}

// ── Copy list formatter ──────────────────────────────────────────────────────

function buildCopyText(items) {
  const sections = [
    { key: 'open',        label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed',   label: 'Completed' },
  ]
  const typeLabel = (t) => TYPE_META[t]?.label || t
  const prioLabel = (p) => PRIORITY_META[p]?.label || null

  return sections
    .map(({ key, label }) => {
      const group = items.filter(i => i.status === key)
      if (group.length === 0) return null
      const lines = group.flatMap(i => {
        const prio = prioLabel(i.priority)
        const header = `- [${typeLabel(i.item_type).toUpperCase()}]${prio ? ` [${prio}]` : ''} ${i.title}`
        return i.description ? [header, `  ${i.description}`] : [header]
      })
      return `## ${label}\n${lines.join('\n')}`
    })
    .filter(Boolean)
    .join('\n\n')
}

// ── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({ item, onEdit }) {
  const completed = item.status === 'completed'
  return (
    <button
      onClick={() => onEdit(item)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors hover:bg-warm-100 ${
        completed ? 'opacity-50' : ''
      }`}
    >
      <TypeBadge type={item.item_type} />
      <span className={`flex-1 text-sm font-medium text-warm-700 ${completed ? 'line-through' : ''}`}>
        {item.title}
      </span>
      <PriorityBadge priority={item.priority} />
      {item.status === 'in_progress' && (
        <span className="text-xs text-yellow-600 font-medium">In progress</span>
      )}
      {completed && (
        <CheckIcon className="w-4 h-4 text-emerald-500 shrink-0" />
      )}
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TrackerPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)   // null | item object | {}
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getTrackerItems()
      setItems(data)
    } catch (err) {
      console.error('Failed to load tracker', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data) => {
    try {
      if (modal?.id) {
        const updated = await updateTrackerItem(modal.id, data)
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
      } else {
        const created = await createTrackerItem(data)
        setItems(prev => [created, ...prev])
      }
    } catch (err) {
      console.error('Failed to save tracker item', err)
    }
    setModal(null)
  }

  const handleDelete = async (id) => {
    try {
      await deleteTrackerItem(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      console.error('Failed to delete tracker item', err)
    }
    setModal(null)
  }

  const handleCopy = () => {
    const text = buildCopyText(items)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    } else {
      // Fallback for non-HTTPS (e.g. plain HTTP over Tailscale)
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const active = items.filter(i => i.status !== 'completed')
  const done   = items.filter(i => i.status === 'completed')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-warm-300 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-warm-200 bg-white shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-warm-700">Tracker</h1>
          <p className="text-sm text-warm-300 mt-0.5">Bugs, features, and changes for Bella</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-warm-400 bg-warm-100 rounded-lg hover:bg-warm-200 transition-colors"
          >
            {copied
              ? <><CheckIcon className="w-4 h-4 text-emerald-500" /> Copied</>
              : <><ClipboardDocumentIcon className="w-4 h-4" /> Copy list</>
            }
          </button>
          <button
            onClick={() => setModal({})}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-warm-500 rounded-lg hover:bg-warm-600 transition-colors"
          >
            <PlusIcon className="w-4 h-4" /> New Item
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Active items */}
        <div>
          {active.length === 0 ? (
            <p className="text-sm text-warm-300 px-4">No open items.</p>
          ) : (
            <div className="bg-white rounded-xl border border-warm-200 divide-y divide-warm-200">
              {active.map(item => (
                <ItemRow key={item.id} item={item} onEdit={setModal} />
              ))}
            </div>
          )}
        </div>

        {/* Completed */}
        {done.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-warm-300 uppercase tracking-wide px-1 mb-2">
              Completed ({done.length})
            </h2>
            <div className="bg-white rounded-xl border border-warm-200 divide-y divide-warm-200">
              {done.map(item => (
                <ItemRow key={item.id} item={item} onEdit={setModal} />
              ))}
            </div>
          </div>
        )}
      </div>

      {modal !== null && (
        <TrackerModal
          item={modal?.id ? modal : null}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
