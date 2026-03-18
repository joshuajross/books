import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Library from './pages/Library'
import Upload from './pages/Upload'
import BookDetail from './pages/BookDetail'
import Settings from './pages/Settings'
import Reader from './pages/Reader'

export default function App() {
  return (
    <Routes>
      {/* Reader is full-screen, outside the normal layout */}
      <Route path="books/:id/read" element={<Reader />} />
      <Route element={<Layout />}>
        <Route index element={<Library />} />
        <Route path="upload" element={<Upload />} />
        <Route path="books/:id" element={<BookDetail />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
