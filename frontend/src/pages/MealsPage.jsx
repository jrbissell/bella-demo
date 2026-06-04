import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, TrashIcon, ArrowTopRightOnSquareIcon, ChevronLeftIcon, ChevronRightIcon, ArrowPathRoundedSquareIcon, BookOpenIcon, CalendarDaysIcon, ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { RRule } from 'rrule'
import { mealsApi } from '../api/meals'
import PlanMealModal from '../components/meals/PlanMealModal'
import SavedMealModal from '../components/meals/SavedMealModal'
import RecipeImportModal from '../components/meals/RecipeImportModal'

const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()        // 0=Sun
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function occursOn(entry, dateStr) {
  if (entry.date === dateStr) return true
  if (!entry.recurrence_rule) return false
  try {
    const [y,  m,  d]  = entry.date.split('-').map(Number)
    const [ty, tm, td] = dateStr.split('-').map(Number)
    const rule  = RRule.fromString(
      `DTSTART:${entry.date.replace(/-/g, '')}T000000Z\nRRULE:${entry.recurrence_rule}`
    )
    const start = new Date(Date.UTC(y,  m  - 1, d))
    const end   = new Date(Date.UTC(ty, tm - 1, td, 23, 59, 59))
    if (end < start) return false
    // RRule returns UTC Date objects — use toISOString to avoid local-time offset shifting the date
    return rule.between(start, end, true).some(h => h.toISOString().slice(0, 10) === dateStr)
  } catch { return false }
}


// ── Saved Meals Panel ─────────────────────────────────────────────────────────

function SavedMealsPanel({ meals, onEdit, onSchedule, onDragStart }) {
  const [confirmId, setConfirmId] = useState(null)
  const qc = useQueryClient()
  const deleteMut = useMutation({
    mutationFn: mealsApi.deleteMeal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meals'] }),
  })

  const grouped = {}
  meals.forEach(m => { (grouped[m.category] ??= []).push(m) })
  const cats = Object.keys(grouped).sort()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-warm-200 shrink-0">
        <span className="text-sm font-semibold text-warm-700">Saved Meals</span>
        <button onClick={() => onEdit(null)}
          className="flex items-center gap-1 text-xs text-warm-500 hover:text-warm-600 font-medium">
          <PlusIcon className="w-3.5 h-3.5" /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {meals.length === 0 && (
          <p className="text-xs text-warm-300 text-center py-8">No saved meals yet.<br />Add one to reuse it on the plan.</p>
        )}
        {cats.map(cat => (
          <div key={cat}>
            <p className="text-[10px] font-semibold text-warm-300 uppercase tracking-wide mb-1 px-1">{cat}</p>
            <div className="space-y-0.5">
              {grouped[cat].map(meal => (
                <div
                  key={meal.id}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.effectAllowed = 'copy'
                    e.dataTransfer.setData('application/json', JSON.stringify({ id: meal.id, name: meal.name }))
                    onDragStart?.()
                  }}
                  className="group flex items-start gap-1.5 py-1.5 px-2 rounded-lg hover:bg-warm-100 cursor-grab active:cursor-grabbing"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-warm-700 truncate">{meal.name}</p>
                    {meal.prep_time && <p className="text-[10px] text-warm-300">{meal.prep_time} min</p>}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                    {meal.url && (
                      <a href={meal.url} target="_blank" rel="noopener noreferrer"
                        className="p-1 text-warm-300 hover:text-indigo-500 rounded" title="Open recipe">
                        <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                      </a>
                    )}
                    <button onClick={() => onEdit(meal)} title="Edit" className="p-1 text-warm-300 hover:text-warm-400 rounded">
                      <PencilIcon className="w-3 h-3" />
                    </button>
                    {confirmId === meal.id ? (
                      <>
                        <button onClick={() => { deleteMut.mutate(meal.id); setConfirmId(null) }}
                          className="px-1.5 py-0.5 text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded">Yes</button>
                        <button onClick={() => setConfirmId(null)}
                          className="px-1.5 py-0.5 text-[10px] text-warm-400 hover:text-warm-600 rounded">No</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmId(meal.id)} title="Delete" className="p-1 text-warm-300 hover:text-red-500 rounded">
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={() => onSchedule(meal)} title="Add to plan" className="p-1 text-warm-500 hover:text-warm-600 rounded">
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


// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MealsPage() {
  const qc = useQueryClient()
  const [tab, setTab]               = useState('planner')    // 'planner' | 'recipes'
  const [weekStart, setWeekStart]   = useState(() => startOfWeek(new Date()))
  const [planModal, setPlanModal]   = useState(null)
  const [savedModal, setSavedModal] = useState(undefined)
  const [importModal, setImportModal] = useState(false)
  const [recipeDetail, setRecipeDetail] = useState(null)     // recipe being viewed
  const [dragOver, setDragOver]     = useState(null)

  const { data: meals   = [] } = useQuery({ queryKey: ['meals'],      queryFn: mealsApi.listMeals })
  const { data: plan    = [] } = useQuery({ queryKey: ['meal-plan'],  queryFn: mealsApi.listPlan })
  const { data: recipes = [] } = useQuery({ queryKey: ['recipes'],    queryFn: mealsApi.listRecipes })

  const invalidatePlan    = () => qc.invalidateQueries({ queryKey: ['meal-plan'] })
  const invalidateMeals   = () => qc.invalidateQueries({ queryKey: ['meals'] })
  const invalidateRecipes = () => qc.invalidateQueries({ queryKey: ['recipes'] })

  const createPlanMut   = useMutation({ mutationFn: mealsApi.createPlan,                                onSuccess: () => { invalidatePlan(); setPlanModal(null) } })
  const updatePlanMut   = useMutation({ mutationFn: ({ id, data }) => mealsApi.updatePlan(id, data),    onSuccess: () => { invalidatePlan(); setPlanModal(null) } })
  const deletePlanMut   = useMutation({ mutationFn: mealsApi.deletePlan,                                onSuccess: () => { invalidatePlan(); setPlanModal(null) } })
  const createMealMut   = useMutation({ mutationFn: mealsApi.createMeal,                                onSuccess: () => { invalidateMeals(); setSavedModal(undefined) } })
  const updateMealMut   = useMutation({ mutationFn: ({ id, data }) => mealsApi.updateMeal(id, data),    onSuccess: () => { invalidateMeals(); setSavedModal(undefined) } })
  const deleteMealMut   = useMutation({ mutationFn: mealsApi.deleteMeal,                                onSuccess: () => { invalidateMeals(); setSavedModal(undefined) } })
  const createRecipeMut = useMutation({ mutationFn: mealsApi.createRecipe,                              onSuccess: () => { invalidateRecipes(); setImportModal(false) } })
  const deleteRecipeMut = useMutation({ mutationFn: mealsApi.deleteRecipe,                              onSuccess: () => { invalidateRecipes(); setRecipeDetail(null) } })

  // Build the 7 days of this week
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    return { date: d, dateStr: toDateStr(d), label: DAY_LABELS[d.getDay()] }
  }), [weekStart])

  // Map dateStr → plan entry for this week (considering RRULEs)
  const mealByDate = useMemo(() => {
    const map = {}
    days.forEach(({ dateStr }) => {
      const found = plan.find(e => occursOn(e, dateStr))
      if (found) map[dateStr] = found
    })
    return map
  }, [plan, days])

  const weekLabel = useMemo(() => {
    const s = days[0].date, e = days[6].date
    if (s.getMonth() === e.getMonth())
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`
  }, [days])

  const handleDrop = (dateStr, existingEntry) => (e) => {
    e.preventDefault()
    setDragOver(null)
    try {
      const meal = JSON.parse(e.dataTransfer.getData('application/json'))
      if (!meal?.name) return
      const payload = { title: meal.name, meal_id: meal.id, date: dateStr }
      if (existingEntry) updatePlanMut.mutate({ id: existingEntry.id, data: payload })
      else createPlanMut.mutate(payload)
    } catch {}
  }

  const handlePlanSave = (form) => {
    if (planModal.entry) updatePlanMut.mutate({ id: planModal.entry.id, data: form })
    else createPlanMut.mutate(form)
  }

  const handleMealSave = (form) => {
    if (savedModal?.id) updateMealMut.mutate({ id: savedModal.id, data: form })
    else createMealMut.mutate(form)
  }

  // Schedule a saved meal: open the plan modal pre-filled with today
  const [scheduleTarget, setScheduleTarget] = useState(null)
  const handleScheduleMeal = (meal) => {
    setScheduleTarget(meal)
    setPlanModal({ dateStr: toDateStr(new Date()), prefill: meal })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-warm-100">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-warm-200 shrink-0">
        {/* Tabs */}
        <div className="flex gap-1">
          {[
            { id: 'planner', label: 'Planner', icon: CalendarDaysIcon },
            { id: 'recipes', label: 'Recipes', icon: BookOpenIcon },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${tab === id ? 'bg-warm-100 text-warm-600' : 'text-warm-400 hover:text-warm-600 hover:bg-warm-50'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Week nav (planner only) */}
        {tab === 'planner' && (
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setWeekStart(d => addDays(d, -7))} className="p-1 rounded hover:bg-warm-100 text-warm-400 hover:text-warm-600 transition-colors">
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="text-xs font-medium text-warm-400 hover:text-warm-600 transition-colors px-2">
              {weekLabel}
            </button>
            <button onClick={() => setWeekStart(d => addDays(d, 7))} className="p-1 rounded hover:bg-warm-100 text-warm-400 hover:text-warm-600 transition-colors">
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Import recipe button (recipes tab) */}
        {tab === 'recipes' && (
          <button onClick={() => setImportModal(true)}
            className="flex items-center gap-1.5 ml-auto px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
            <ArrowDownTrayIcon className="w-3.5 h-3.5" /> Import Recipe
          </button>
        )}
      </div>

      {/* ── PLANNER TAB ─────────────────────────────────────────────────────── */}
      {tab === 'planner' && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 p-4 overflow-y-auto">
            <div className="grid grid-cols-7 gap-3">
              {days.map(({ date, dateStr, label }) => {
                const isToday = dateStr === toDateStr(new Date())
                const entry   = mealByDate[dateStr]
                return (
                  <div key={dateStr} className="flex flex-col gap-1.5">
                    <div className="text-center">
                      <div className="text-[10px] font-semibold text-warm-400 uppercase">{label}</div>
                      <div className={`text-sm font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-warm-500 text-white' : 'text-warm-600'}`}>
                        {date.getDate()}
                      </div>
                    </div>
                    <div
                      onClick={() => setPlanModal({ dateStr, entry: entry || null })}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(dateStr) }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}
                      onDrop={handleDrop(dateStr, entry)}
                      className={`w-full min-h-[90px] rounded-xl border-2 text-left p-2.5 transition-all text-xs cursor-pointer select-none
                        ${dragOver === dateStr ? 'border-indigo-400 bg-indigo-50 shadow-md scale-[1.02]'
                          : entry ? 'border-warm-300 bg-white shadow-sm hover:border-warm-400'
                          : 'border-dashed border-warm-200 bg-white/60 hover:border-warm-300 hover:bg-white'}`}
                    >
                      {entry ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-warm-700 leading-tight">{entry.title}</p>
                          {entry.recurrence_rule && <ArrowPathRoundedSquareIcon className="w-3 h-3 text-warm-300" />}
                          {entry.notes && <p className="text-[10px] text-warm-400 italic">{entry.notes}</p>}
                        </div>
                      ) : (
                        <span className={`text-[10px] ${dragOver === dateStr ? 'text-indigo-400 font-medium' : 'text-warm-300'}`}>
                          {dragOver === dateStr ? 'Drop to plan' : '+ Add meal'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="w-px bg-warm-200 shrink-0" />
          <div className="w-72 shrink-0 bg-white flex flex-col min-h-0">
            <SavedMealsPanel meals={meals} onEdit={m => setSavedModal(m ?? null)} onSchedule={handleScheduleMeal} onDragStart={() => setDragOver(null)} />
          </div>
        </div>
      )}

      {/* ── RECIPES TAB ─────────────────────────────────────────────────────── */}
      {tab === 'recipes' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {recipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-warm-300 gap-3">
              <BookOpenIcon className="w-12 h-12 opacity-30" />
              <p className="text-sm">No recipes yet.</p>
              <button onClick={() => setImportModal(true)}
                className="flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-700 transition-colors">
                <ArrowDownTrayIcon className="w-4 h-4" /> Import your first recipe
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
              {recipes.map(recipe => (
                <div key={recipe.id} onClick={() => setRecipeDetail(recipe)}
                  className="bg-white rounded-xl border border-warm-200 p-4 cursor-pointer hover:border-warm-300 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-warm-700 leading-tight">{recipe.name}</h3>
                    {recipe.source_url && (
                      <a href={recipe.source_url} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-warm-300 hover:text-indigo-500 shrink-0 transition-colors">
                        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  {recipe.servings && (
                    <p className="text-xs text-warm-400 mb-2">{recipe.servings} servings{recipe.serving_size ? ` · ${recipe.serving_size}` : ''}</p>
                  )}
                  {/* Macro pills */}
                  {(recipe.calories || recipe.protein_g || recipe.carbs_g || recipe.fat_g) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {recipe.calories  && <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-700">{Math.round(recipe.calories)} cal</span>}
                      {recipe.protein_g && <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-50 text-blue-700">{Math.round(recipe.protein_g)}g protein</span>}
                      {recipe.carbs_g   && <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-50 text-green-700">{Math.round(recipe.carbs_g)}g carbs</span>}
                      {recipe.fat_g     && <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-orange-50 text-orange-700">{Math.round(recipe.fat_g)}g fat</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── RECIPE DETAIL ────────────────────────────────────────────────────── */}
      {recipeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between px-6 py-4 border-b border-warm-200 shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-lg font-bold text-warm-700">{recipeDetail.name}</h2>
                {recipeDetail.servings && (
                  <p className="text-xs text-warm-400 mt-0.5">{recipeDetail.servings} servings{recipeDetail.serving_size ? ` · ${recipeDetail.serving_size} per serving` : ''}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {recipeDetail.source_url && (
                  <a href={recipeDetail.source_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                    <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" /> Source
                  </a>
                )}
                <button onClick={() => { if (window.confirm('Delete this recipe?')) deleteRecipeMut.mutate(recipeDetail.id) }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors">Delete</button>
                <button onClick={() => setRecipeDetail(null)} className="text-warm-300 hover:text-warm-400 ml-1">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Macros */}
              {(recipeDetail.calories || recipeDetail.protein_g || recipeDetail.carbs_g || recipeDetail.fat_g) && (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Calories', value: recipeDetail.calories,  unit: 'kcal', color: 'bg-amber-50 text-amber-700' },
                    { label: 'Protein',  value: recipeDetail.protein_g, unit: 'g',    color: 'bg-blue-50 text-blue-700' },
                    { label: 'Carbs',    value: recipeDetail.carbs_g,   unit: 'g',    color: 'bg-green-50 text-green-700' },
                    { label: 'Fat',      value: recipeDetail.fat_g,     unit: 'g',    color: 'bg-orange-50 text-orange-700' },
                  ].filter(m => m.value != null).map(({ label, value, unit, color }) => (
                    <div key={label} className={`flex flex-col items-center py-3 rounded-xl ${color}`}>
                      <span className="text-lg font-bold">{Math.round(value)}<span className="text-xs font-normal ml-0.5">{unit}</span></span>
                      <span className="text-xs opacity-70 mt-0.5">{label}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Ingredients */}
              {recipeDetail.ingredients && (() => {
                try {
                  const ings = JSON.parse(recipeDetail.ingredients)
                  return ings.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-warm-600 mb-2">Ingredients</h3>
                      <ul className="space-y-1">
                        {ings.map((ing, i) => (
                          <li key={i} className="flex gap-2 text-sm text-warm-700">
                            <span className="text-warm-300 shrink-0">·</span>{ing}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                } catch { return null }
              })()}
              {/* Instructions */}
              {recipeDetail.instructions && (() => {
                try {
                  const steps = JSON.parse(recipeDetail.instructions)
                  return steps.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-warm-600 mb-2">Instructions</h3>
                      <ol className="space-y-3">
                        {steps.map((step, i) => (
                          <li key={i} className="flex gap-3 text-sm text-warm-700">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-warm-100 text-warm-500 flex items-center justify-center text-xs font-bold">{i+1}</span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null
                } catch { return null }
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {planModal && (
        <PlanMealModal
          dateStr={planModal.dateStr}
          entry={planModal.entry}
          meals={meals}
          onSave={handlePlanSave}
          onDelete={planModal.entry ? (id) => deletePlanMut.mutate(id) : null}
          onSaveMeal={(name) => createMealMut.mutate({ name, category: 'Other' })}
          onClose={() => { setPlanModal(null); setScheduleTarget(null) }}
        />
      )}
      {savedModal !== undefined && (
        <SavedMealModal
          meal={savedModal}
          onSave={handleMealSave}
          onDelete={savedModal ? (id) => deleteMealMut.mutate(id) : null}
          onClose={() => setSavedModal(undefined)}
        />
      )}
      {importModal && (
        <RecipeImportModal
          onSave={(data) => createRecipeMut.mutate(data)}
          onClose={() => setImportModal(false)}
        />
      )}
    </div>
  )
}
