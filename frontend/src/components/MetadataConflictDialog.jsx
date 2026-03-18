import { useState } from 'react'
import { X, BookOpen, Loader2 } from 'lucide-react'
import { applyMetadata } from '../api'

const FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'language', label: 'Language' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'tags', label: 'Tags' },
  { key: 'description', label: 'Description' },
]

function differs(online, local) {
  return online && online.trim() !== (local || '').trim()
}

export default function MetadataConflictDialog({ book, suggestion, onDone }) {
  const conflicts = FIELDS.filter(({ key }) => differs(suggestion[key], book[key]))
  const hasCoverConflict = Boolean(suggestion.cover_url && !book.cover_path)

  // Default: use the online value for every conflict
  const [selected, setSelected] = useState(() =>
    Object.fromEntries([
      ...conflicts.map(({ key }) => [key, true]),
      ['cover', hasCoverConflict],
    ])
  )
  const [applying, setApplying] = useState(false)

  const toggle = (key) => setSelected((prev) => ({ ...prev, [key]: !prev[key] }))

  const handleApply = async () => {
    setApplying(true)
    try {
      const payload = {}
      for (const { key } of conflicts) {
        if (selected[key]) payload[key] = suggestion[key]
      }
      if (selected.cover && suggestion.cover_url) payload.cover_url = suggestion.cover_url
      await applyMetadata(book.id, payload)
    } catch { /* non-fatal */ }
    onDone()
  }

  if (conflicts.length === 0 && !hasCoverConflict) {
    // Nothing to resolve — caller should not render this, but guard anyway
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onDone()}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Better metadata found online</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {suggestion.source} · <span className="italic">{book.title}</span>
            </p>
          </div>
          <button className="btn-ghost p-1 ml-3 flex-shrink-0" onClick={onDone}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50">

          {/* Cover */}
          {hasCoverConflict && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cover</span>
                <button
                  onClick={() => toggle('cover')}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                    selected.cover ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {selected.cover ? 'Use online' : 'Keep file'}
                </button>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="text-center">
                  <div className="w-16 h-20 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                    {book.cover_path
                      ? <img src={book.cover_path} alt="" className="w-full h-full object-cover" />
                      : <BookOpen className="w-6 h-6 text-gray-300" />}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">File</p>
                </div>
                <div className="text-center">
                  <img src={suggestion.cover_url} alt="" className="w-16 h-20 object-cover rounded" />
                  <p className="text-xs text-gray-400 mt-1">Online</p>
                </div>
              </div>
            </div>
          )}

          {/* Field conflicts */}
          {conflicts.map(({ key, label }) => (
            <div key={key} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
                <button
                  onClick={() => toggle(key)}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                    selected[key] ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {selected[key] ? 'Use online' : 'Keep file'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`p-2 rounded ${!selected[key] ? 'ring-2 ring-brand-400 bg-brand-50' : 'bg-gray-50'}`}>
                  <p className="font-medium text-gray-400 mb-1">File</p>
                  <p className={`line-clamp-4 ${!selected[key] ? 'text-gray-800' : 'text-gray-400'}`}>
                    {book[key] || <span className="italic">empty</span>}
                  </p>
                </div>
                <div className={`p-2 rounded ${selected[key] ? 'ring-2 ring-brand-400 bg-brand-50' : 'bg-gray-50'}`}>
                  <p className="font-medium text-gray-400 mb-1">Online</p>
                  <p className={`line-clamp-4 ${selected[key] ? 'text-gray-800' : 'text-gray-400'}`}>
                    {suggestion[key]}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 justify-end flex-shrink-0">
          <button className="btn-ghost" onClick={onDone}>Skip</button>
          <button className="btn-primary" onClick={handleApply} disabled={applying}>
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Apply selected
          </button>
        </div>
      </div>
    </div>
  )
}
