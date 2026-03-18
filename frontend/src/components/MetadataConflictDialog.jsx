import { useState } from 'react'
import { X, Loader2, BookOpen } from 'lucide-react'
import { applyMetadata } from '../api'

const ENRICH_FIELDS = ['title', 'author', 'description', 'publisher', 'language', 'isbn', 'tags']

export default function MetadataConfirmDialog({ book, suggestion, onDone }) {
  const [applying, setApplying] = useState(false)

  const handleApply = async () => {
    setApplying(true)
    try {
      const payload = {}
      for (const key of ENRICH_FIELDS) {
        if (suggestion[key]) payload[key] = suggestion[key]
      }
      if (suggestion.cover_url) payload.cover_url = suggestion.cover_url
      await applyMetadata(book.id, payload)
    } catch { /* non-fatal */ } finally {
      setApplying(false)
    }
    onDone()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onDone()}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <h2 className="font-semibold text-gray-900">Is this the right book?</h2>
          <button className="btn-ghost p-1 ml-3 flex-shrink-0" onClick={onDone}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex gap-4">
          {/* Cover */}
          <div className="w-16 h-20 flex-shrink-0 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
            {suggestion.cover_url
              ? <img src={suggestion.cover_url} alt="" className="w-full h-full object-cover" />
              : <BookOpen className="w-6 h-6 text-gray-300" />}
          </div>

          {/* Info */}
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
          <button className="btn-ghost" onClick={onDone}>No, skip</button>
          <button className="btn-primary" onClick={handleApply} disabled={applying}>
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Yes, apply
          </button>
        </div>
      </div>
    </div>
  )
}
