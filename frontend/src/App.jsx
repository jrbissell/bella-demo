import { useState } from 'react'
import { useIsMobile } from './hooks/useIsMobile'
import MobileApp from './MobileApp'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import HomePage from './pages/HomePage'
import RoutinesPage from './pages/RoutinesPage'
import BudgetPage from './pages/BudgetPage'
import CalendarPage from './pages/CalendarPage'
import ChoresPage from './pages/ChoresPage'
import MealsPage from './pages/MealsPage'
import ShoppingPage from './pages/ShoppingPage'
import TrackerPage from './pages/TrackerPage'

const PAGES = {
  home:     HomePage,
  routines: RoutinesPage,
  budget:   BudgetPage,
  calendar: CalendarPage,
  chores:   ChoresPage,
  meals:    MealsPage,
  shopping: ShoppingPage,
  tracker:  TrackerPage,
}

export default function App() {
  const isMobile = useIsMobile()
  const [page, setPage] = useState('home')

  if (isMobile) return <MobileApp />

  const Page = PAGES[page] || HomePage
  return (
    <div className="flex h-screen bg-warm-100 overflow-hidden">
      <Sidebar page={page} onNavigate={setPage} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header page={page} />
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Page onNavigate={setPage} />
        </main>
      </div>
    </div>
  )
}
