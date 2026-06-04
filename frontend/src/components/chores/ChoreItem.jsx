import { CheckIcon, CalendarIcon, ArrowPathIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import { describeRRule } from '../calendar/RecurrencePicker'

const PRIORITY_COLORS = { 1: 'text-red-500', 5: 'text-honey-500', 9: 'text-sky-400', 0: '' }
const PRIORITY_LABELS = { 1: 'High', 5: 'Med', 9: 'Low', 0: '' }

function formatDue(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  const diff = d - now
  const dayMs = 86400000
  if (diff < 0)         return { label: 'Overdue',   cls: 'text-red-500' }
  if (diff < dayMs)     return { label: 'Today',      cls: 'text-honey-500' }
  if (diff < 2 * dayMs) return { label: 'Tomorrow',   cls: 'text-yellow-600' }
  return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: 'text-warm-300' }
}

export default function ChoreItem({ chore, onToggle, onClick }) {
  const due = formatDue(chore.due_date)
  const repeatLabel = chore.recurrence_rule ? describeRRule(chore.recurrence_rule) : null
  const isVirtual  = Boolean(chore._virtual)
  const isHoneyDo  = chore.chore_type === 'honey_do'
  // Gray out chores not yet due today (due tomorrow or later)
  const isFuture   = !chore.completed && chore.due_date &&
    (new Date(chore.due_date) - new Date()) >= 86400000

  if (isVirtual) {
    return (
      <div
        className="flex items-start gap-3 p-3 rounded-xl border border-dashed border-warm-200 bg-warm-100/60 cursor-pointer hover:border-warm-300 transition-all opacity-70"
        onClick={() => onClick(chore)}
      >
        <div className="mt-0.5 w-5 h-5 rounded-full border-2 border-dashed border-warm-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug text-warm-400">{chore.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {due && (
              <span className={`text-xs flex items-center gap-1 ${due.cls}`}>
                <CalendarIcon className="w-3 h-3" />{due.label}
              </span>
            )}
            {repeatLabel && (
              <span className="text-xs flex items-center gap-1 text-warm-400">
                <ArrowPathIcon className="w-3 h-3" />{repeatLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all group relative overflow-visible ${
        chore.completed
          ? 'bg-warm-50 border-warm-100 opacity-75 hover:opacity-100'
          : isHoneyDo
          ? `bg-amber-50 border-amber-300 hover:border-amber-400 hover:shadow-sm${isFuture ? ' opacity-50 hover:opacity-80' : ''}`
          : `bg-white border-warm-200 hover:border-warm-300 hover:shadow-sm${isFuture ? ' opacity-50 hover:opacity-80' : ''}`
      }`}
      onClick={() => onClick(chore)}
    >
      {/* Honey drip animation */}
      {isHoneyDo && !chore.completed && (
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden pointer-events-none" style={{ height: 0 }}>
          <div className="honey-drip-drop" />
          <div className="honey-drip-drop" />
          <div className="honey-drip-drop" />
          <div className="honey-drip-drop" />
        </div>
      )}

      {/* Checkbox */}
      <button
        className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
          chore.completed
            ? 'bg-sage-500 border-sage-500 hover:bg-red-400 hover:border-red-400'
            : isHoneyDo
            ? 'border-amber-400 hover:border-amber-500'
            : 'border-warm-200 hover:border-warm-500'
        }`}
        onClick={e => { e.stopPropagation(); onToggle(chore) }}
        title={chore.completed ? 'Uncheck' : 'Mark done'}
      >
        {chore.completed
          ? <span className="contents">
              <CheckIcon className="w-3 h-3 text-white group-hover:hidden" strokeWidth={3} />
              <ArrowUturnLeftIcon className="w-3 h-3 text-white hidden group-hover:block" strokeWidth={3} />
            </span>
          : null}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${
          chore.completed ? 'line-through text-warm-300' : isHoneyDo ? 'text-amber-800' : 'text-warm-700'
        }`}>
          {isHoneyDo && !chore.completed && <span className="mr-1">🍯</span>}
          {chore.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {chore.priority > 0 && (
            <span className={`text-xs font-semibold ${PRIORITY_COLORS[chore.priority]}`}>
              {PRIORITY_LABELS[chore.priority]}
            </span>
          )}
          {due && (
            <span className={`text-xs flex items-center gap-1 ${due.cls}`}>
              <CalendarIcon className="w-3 h-3" />{due.label}
            </span>
          )}
          {repeatLabel && (
            <span className="text-xs flex items-center gap-1 text-warm-400">
              <ArrowPathIcon className="w-3 h-3" />{repeatLabel}
            </span>
          )}
          {chore.notes && (
            <span className="text-xs text-warm-300 truncate max-w-[120px]">{chore.notes}</span>
          )}
        </div>
      </div>
    </div>
  )
}
