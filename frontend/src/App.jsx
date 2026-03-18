import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Library from './pages/Library'
import Upload from './pages/Upload'
import BookDetail from './pages/BookDetail'
import Settings from './pages/Settings'
import Reader from './pages/Reader'
import Login from './pages/Login'

function RequireAuth({ children }) {
  const { token } = useAuth()
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Reader is full-screen, outside the normal layout */}
        <Route path="books/:id/read" element={<RequireAuth><Reader /></RequireAuth>} />

        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Library />} />
          <Route path="upload" element={<Upload />} />
          <Route path="books/:id" element={<BookDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
