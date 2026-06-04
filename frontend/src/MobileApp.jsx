import { useState } from 'react'
import { XMarkIcon, HomeIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'
import MobileHomePage from './pages/MobileHomePage'
import MobileShoppingPage from './pages/MobileShoppingPage'

const NAV = [
  { id: 'home',     label: 'Home',     Icon: HomeIcon },
  { id: 'shopping', label: 'Shopping', Icon: ShoppingBagIcon },
]

const PAGES = {
  home:     MobileHomePage,
  shopping: MobileShoppingPage,
}

export default function MobileApp() {
  const [page, setPage]           = useState('home')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const Page = PAGES[page] ?? MobileHomePage

  function navigate(id) {
    setPage(id)
    setDrawerOpen(false)
  }

  return (
    <div className="h-dvh flex flex-col bg-warm-50 overflow-hidden">
      <Page onNavigate={navigate} onMenu={() => setDrawerOpen(true)} />

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />

          <div className="relative w-64 bg-white flex flex-col shadow-2xl safe-top">
            <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100">
              <span className="text-lg font-bold text-warm-700">Bella</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 text-warm-400 active:bg-warm-100 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-2 overflow-y-auto">
              {NAV.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors active:bg-warm-100 ${
                    page === id
                      ? 'bg-warm-50 text-warm-700 font-semibold border-r-2 border-warm-500'
                      : 'text-warm-500'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </nav>

            <div className="px-5 py-4 border-t border-warm-100 safe-bottom">
              <p className="text-xs text-warm-300">Bella · Family Hub</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
