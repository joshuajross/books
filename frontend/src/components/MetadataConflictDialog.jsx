import { useState } from 'react'
import { X, BookOpen, Search, Loader2, Check } from 'lucide-react'
import { searchMetadata, applyMetadata } from '../api'

const ENRICH_FIELDS = ['title', 'author', 'description', 'publisher', 'language', 'isbn', 'tags']

function buildPayload(result) {
  const payload = {}
  for (const key of ENRICH_FIELDS) {
    if (result[key]) payload[key] = result[key]
  }
  if (result.cover_url) payload.cover_url = result.cover_url
  return payload
}

export default function MetadataConfirmDialog({ book, suggestion, onDone }) {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState(book.title || '')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleApply = (result) => {
    applyMetadata(book.id, buildPayload(result)).catch(() => {})
    onDone()
  }

  const doSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setResults(null)
    try {
      setResults(await searchMetadata(query))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onDone()}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              {searching ? 'Search for metadata' : 'Is this the right book?'}
            </h2>
            {!searching && (
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{book.filename}</p>
            )}
          </div>
          <button className="btn-ghost p-1 ml-3 flex-shrink-0" onClick={onDone}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {!searching ? (
          <>
            <div className="p-5 flex gap-4">
              <div className="w-16 h-20 flex-shrink-0 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                {suggestion.cover_url
                  ? <img src={suggestion.cover_url} alt="" className="w-full h-full object-cover" />
                  : <BookOpen className="w-6 h-6 text-gray-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm leading-snug">{suggestion.title}</p>
                {suggestion.author && <p className="text-sm text-gray-500 mt-0.5">{suggestion.author}</p>}
                {suggestion.publisher && <p className="text-xs text-gray-400 mt-1">{suggestion.publisher}</p>}
                <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {suggestion.source}
                </span>
              </div>
            </div>

            <p className="px-5 pb-1 text-xs text-gray-400">
              Applying will fill in description, publisher, ISBN, tags, and cover.
            </p>

            <div className="p-4 flex gap-2 justify-end">
              <button className="btn-ghost" onClick={onDone}>Skip</button>
              <button className="btn-ghost" onClick={() => setSearching(true)}>
                <Search className="w-3.5 h-3.5" />
                Search instead
              </button>
              <button className="btn-primary" onClick={() => handleApply(suggestion)}>Yes, apply</button>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 flex gap-2">
              <input
                className="input flex-1"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                placeholder="Title or author…"
                autoFocus
              />
              <button className="btn-primary flex-shrink-0" onClick={doSearch} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {results !== null && results.length === 0 && (
              <p className="px-4 pb-3 text-sm text-gray-400">No results found.</p>
            )}

            {results && results.length > 0 && (
              <div className="px-4 pb-2 space-y-2 max-h-64 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className="card p-3 flex gap-3">
                    {r.cover_url
                      ? <img src={r.cover_url} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0" />
                      : <div className="w-10 h-14 flex-shrink-0 rounded bg-gray-100 flex items-center justify-center">
                          <BookOpen className="w-4 h-4 text-gray-300" />
                        </div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{r.title}</p>
                      <p className="text-xs text-gray-500 truncate">{r.author}</p>
                      {r.publisher && <p className="text-xs text-gray-400">{r.publisher}</p>}
                    </div>
                    <button
                      className="btn-primary text-xs flex-shrink-0 self-center"
                      onClick={() => handleApply(r)}
                    >
                      <Check className="w-3 h-3" />
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 pt-2 flex gap-2 justify-end border-t border-gray-100">
              <button className="btn-ghost" onClick={onDone}>Skip</button>
              <button className="btn-ghost" onClick={() => { setSearching(false); setResults(null) }}>
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
