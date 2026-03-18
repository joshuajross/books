import { useState } from 'react'
import { Search, Loader2, Check, ExternalLink } from 'lucide-react'
import { searchMetadata, applyMetadata } from '../api'

const SOURCE_LABEL = { google: 'Google Books', openlibrary: 'OpenLibrary' }

export default function MetadataSearch({ book, onApplied }) {
  const [query, setQuery] = useState(book.title)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(null)
  const [error, setError] = useState('')

  const doSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      setResults(await searchMetadata(query))
    } catch {
      setError('Search failed.')
    } finally {
      setLoading(false)
    }
  }

  const apply = async (result) => {
    setApplying(result)
    try {
      await applyMetadata(book.id, result)
      onApplied()
    } catch {
      setError('Failed to apply metadata.')
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Fetch Metadata</h3>
      <div className="flex gap-2 mb-3">
        <input
          className="input flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder="Search by title or author…"
        />
        <button className="btn-primary flex-shrink-0" onClick={doSearch} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {results !== null && results.length === 0 && (
        <p className="text-sm text-gray-400">No results found.</p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className="card p-3 flex gap-3">
              {r.cover_url && (
                <img src={r.cover_url} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-xs text-gray-500 truncate">{r.author}</p>
                {r.publisher && <p className="text-xs text-gray-400">{r.publisher}</p>}
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded mt-1 inline-block">
                  {SOURCE_LABEL[r.source] || r.source}
                </span>
              </div>
              <button
                className="btn-primary text-xs flex-shrink-0 self-center"
                onClick={() => apply(r)}
                disabled={applying === r}
              >
                {applying === r
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Check className="w-3 h-3" />}
                Apply
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
