import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Upload, BookOpen, Loader2 } from 'lucide-react'
import { fetchBooks } from '../api'
import BookCard from '../components/BookCard'

const FORMATS = ['', 'epub', 'pdf', 'mobi', 'azw3', 'fb2', 'cbz']

export default function Library() {
  const [books, setBooks] = useState([])
  const [query, setQuery] = useState('')
  const [format, setFormat] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchBooks(query, format)
      setBooks(data)
    } catch {
      setError('Failed to load library.')
    } finally {
      setLoading(false)
    }
  }, [query, format])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div>
      {/* Search bar */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="Search by title, author, or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="input w-36"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="">All formats</option>
          {FORMATS.filter(Boolean).map((f) => (
            <option key={f} value={f}>{f.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        </div>
      ) : error ? (
        <p className="text-center text-red-500 py-12">{error}</p>
      ) : books.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">
            {query || format ? 'No books match your search.' : 'Your library is empty.'}
          </p>
          {!query && !format && (
            <Link to="/upload" className="btn-primary">
              <Upload className="w-4 h-4" />
              Upload your first book
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">
            {books.length} book{books.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
