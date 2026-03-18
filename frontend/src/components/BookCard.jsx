import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

const FORMAT_COLORS = {
  epub: 'bg-green-100 text-green-700',
  pdf: 'bg-red-100 text-red-700',
  mobi: 'bg-orange-100 text-orange-700',
  azw: 'bg-orange-100 text-orange-700',
  azw3: 'bg-orange-100 text-orange-700',
  fb2: 'bg-purple-100 text-purple-700',
  cbz: 'bg-blue-100 text-blue-700',
  cbr: 'bg-blue-100 text-blue-700',
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function BookCard({ book }) {
  const colorClass = FORMAT_COLORS[book.file_format] || 'bg-gray-100 text-gray-600'

  return (
    <Link
      to={`/books/${book.id}`}
      className="card flex gap-3 p-4 hover:shadow-md transition-shadow group"
    >
      {/* Cover */}
      <div className="w-16 h-24 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
        {book.cover_path ? (
          <img
            src={book.cover_path}
            alt={book.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
          />
        ) : null}
        <div
          className="w-full h-full flex items-center justify-center text-gray-300"
          style={{ display: book.cover_path ? 'none' : 'flex' }}
        >
          <BookOpen className="w-8 h-8" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 truncate group-hover:text-brand-600 leading-tight">
          {book.title}
        </h3>
        <p className="text-sm text-gray-500 mt-0.5 truncate">{book.author}</p>
        {book.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{book.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${colorClass}`}>
            {book.file_format.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400">{formatSize(book.file_size)}</span>
        </div>
      </div>
    </Link>
  )
}
