import { Outlet, NavLink } from 'react-router-dom'
import { BookOpen, Upload, Library, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-gray-900">
            <BookOpen className="w-5 h-5 text-brand-600" />
            BookShelf
          </NavLink>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `btn-ghost text-sm ${isActive ? 'bg-gray-100 text-gray-900' : ''}`
              }
            >
              <Library className="w-4 h-4" />
              Library
            </NavLink>
            <NavLink
              to="/upload"
              className={({ isActive }) =>
                `btn-ghost text-sm ${isActive ? 'bg-gray-100 text-gray-900' : ''}`
              }
            >
              <Upload className="w-4 h-4" />
              Upload
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `btn-ghost text-sm ${isActive ? 'bg-gray-100 text-gray-900' : ''}`
              }
            >
              <Settings className="w-4 h-4" />
              Settings
            </NavLink>
            <button className="btn-ghost text-sm text-gray-500" onClick={logout} title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        BookShelf — your personal ebook library
      </footer>
    </div>
  )
}
