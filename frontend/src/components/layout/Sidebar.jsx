import { useQuery } from '@tanstack/react-query'
import {
  HomeIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  SparklesIcon,
  BanknotesIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeSolid,
  CalendarDaysIcon as CalendarSolid,
  ClipboardDocumentListIcon as ChoresSolid,
  ShoppingCartIcon as ShoppingSolid,
  BanknotesIcon as BudgetSolid,
  ClockIcon as ClockSolid,
} from '@heroicons/react/24/solid'
import { familyApi } from '../../api/family'

const mainNav = [
  { id: 'home',      label: 'Home',      icon: HomeIcon,                  activeIcon: HomeSolid },
  { id: 'calendar',  label: 'Calendar',  icon: CalendarDaysIcon,          activeIcon: CalendarSolid },
  { id: 'chores',    label: 'Chores',    icon: ClipboardDocumentListIcon, activeIcon: ChoresSolid },
  { id: 'routines',  label: 'Routines',  icon: ClockIcon,                 activeIcon: ClockSolid },
  { id: 'shopping',  label: 'Shopping',  icon: ShoppingCartIcon,          activeIcon: ShoppingSolid },
  { id: 'meals',     label: 'Meals',     icon: SparklesIcon,              activeIcon: SparklesIcon },
  { id: 'budget',    label: 'Budget',    icon: BanknotesIcon,             activeIcon: BudgetSolid },
]

const bottomNav = []

function getInitials(name) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function NavButton({ item, active, onNavigate }) {
  const Icon = active && item.activeIcon ? item.activeIcon : item.icon
  return (
    <button
      onClick={() => !item.soon && onNavigate(item.id)}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
        ${active
          ? 'bg-warm-50 text-warm-500 font-semibold'
          : 'text-warm-400 hover:bg-warm-100 hover:text-warm-700'}
        ${item.soon ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
      disabled={item.soon}
      title={item.soon ? `${item.label} — coming soon` : item.label}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="hidden md:block">{item.label}</span>
      {item.soon && (
        <span className="hidden md:block ml-auto text-xs bg-warm-100 text-warm-300 px-1.5 py-0.5 rounded-md">
          Soon
        </span>
      )}
    </button>
  )
}

export default function Sidebar({ page, onNavigate }) {
  const { data: members = [] } = useQuery({
    queryKey: ['family-members'],
    queryFn: familyApi.list,
  })

  return (
    <aside className="flex flex-col w-16 md:w-60 bg-white border-r border-warm-200 shrink-0 h-screen">

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <span className="text-2xl select-none">🐱</span>
        <div className="hidden md:block">
          <div className="text-lg font-bold text-warm-700 leading-tight">Bella</div>
          <div className="text-xs text-warm-300 font-medium">Family Organizer</div>
        </div>
      </div>

      {/* Family member avatars */}
      {members.length > 0 && (
        <div className="hidden md:flex px-4 pb-4 flex-wrap gap-2 justify-center">
          {members.map(m => (
            <div
              key={m.id}
              title={m.name}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ring-white"
              style={{ backgroundColor: m.color }}
            >
              {getInitials(m.name)}
            </div>
          ))}
        </div>
      )}

      <div className="mx-4 border-t border-warm-200 mb-3" />

      {/* Main nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {mainNav.map(item => (
          <NavButton key={item.id} item={item} active={page === item.id} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 pb-4 pt-3 border-t border-warm-200 space-y-0.5">
        {bottomNav.map(item => (
          <NavButton key={item.id} item={item} active={page === item.id} onNavigate={onNavigate} />
        ))}
        <p className="hidden md:block text-xs text-warm-300 px-3 pt-2">Bella v0.1</p>
      </div>

    </aside>
  )
}
