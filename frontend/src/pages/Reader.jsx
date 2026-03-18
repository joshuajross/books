import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Sun, Moon,
  Minus, Plus, Loader2, BookOpen,
} from 'lucide-react'
import { fetchBooks } from '../api'

// epub.js loaded from CDN via index.html script tag
// PDF uses the browser's built-in viewer via iframe

const FONT_SIZES = [14, 16, 18, 20, 24, 28]

function EpubReader({ bookId, title }) {
  const viewerRef = useRef(null)
  const bookRef = useRef(null)
  const renditionRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [dark, setDark] = useState(false)
  const [fontIdx, setFontIdx] = useState(2)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!viewerRef.current) return
    if (typeof window.ePub === 'undefined') {
      setError('epub.js failed to load.')
      return
    }

    const book = window.ePub(`/api/books/${bookId}/raw`)
    bookRef.current = book

    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
    })
    renditionRef.current = rendition

    const saved = localStorage.getItem(`epub-cfi-${bookId}`)
    rendition.display(saved || undefined).then(() => setReady(true)).catch(() => setReady(true))

    rendition.on('relocated', (loc) => {
      localStorage.setItem(`epub-cfi-${bookId}`, loc.start.cfi)
      book.locations.percentageFromCfi(loc.start.cfi).then(setProgress)
    })

    book.ready.then(() => book.locations.generate(1024))

    return () => {
      book.destroy()
    }
  }, [bookId])

  useEffect(() => {
    if (!renditionRef.current) return
    const theme = dark
      ? { body: { background: '#1a1a2e', color: '#e0e0e0' }, a: { color: '#90caf9' } }
      : { body: { background: '#fff', color: '#1a1a1a' } }
    renditionRef.current.themes.override('body', theme.body)
    renditionRef.current.themes.override('a', theme.a || {})
  }, [dark])

  useEffect(() => {
    if (!renditionRef.current) return
    renditionRef.current.themes.fontSize(`${FONT_SIZES[fontIdx]}px`)
  }, [fontIdx])

  const prev = () => renditionRef.current?.prev()
  const next = () => renditionRef.current?.next()

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (error) return (
    <div className="flex-1 flex items-center justify-center text-red-500">{error}</div>
  )

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${dark ? 'bg-[#1a1a2e]' : 'bg-white'}`}>
      {/* Reader controls */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b text-sm ${dark ? 'bg-[#12122a] border-gray-700' : 'bg-white border-gray-100'}`}>
        <button onClick={prev} className="btn-ghost p-1"><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={next} className="btn-ghost p-1"><ChevronRight className="w-4 h-4" /></button>
        <div className="flex-1 mx-2">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-400'}`}>
          {Math.round(progress * 100)}%
        </span>
        <button onClick={() => setFontIdx(i => Math.max(0, i - 1))} className="btn-ghost p-1">
          <Minus className="w-3 h-3" />
        </button>
        <span className={`text-xs w-6 text-center ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{FONT_SIZES[fontIdx]}</span>
        <button onClick={() => setFontIdx(i => Math.min(FONT_SIZES.length - 1, i + 1))} className="btn-ghost p-1">
          <Plus className="w-3 h-3" />
        </button>
        <button onClick={() => setDark(d => !d)} className="btn-ghost p-1">
          {dark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* EPUB viewport */}
      <div className="flex-1 relative">
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        )}
        <div ref={viewerRef} className="w-full h-full" />
      </div>

      {/* Click zones */}
      <div className="absolute inset-y-16 left-0 w-16 cursor-pointer z-10" onClick={prev} />
      <div className="absolute inset-y-16 right-0 w-16 cursor-pointer z-10" onClick={next} />
    </div>
  )
}

function PdfReader({ bookId }) {
  return (
    <div className="flex-1">
      <iframe
        src={`/api/books/${bookId}/raw`}
        className="w-full h-full border-0"
        title="PDF Reader"
      />
    </div>
  )
}

function UnsupportedReader({ format }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
      <BookOpen className="w-12 h-12 text-gray-200" />
      <p>In-browser reading is not supported for <strong>.{format}</strong> files.</p>
      <p className="text-sm">Download the file and open it in your eReader app.</p>
    </div>
  )
}

export default function Reader() {
  const { id } = useParams()
  const [book, setBook] = useState(null)

  useEffect(() => {
    fetchBooks().then((books) => {
      const b = books.find((b) => b.id === Number(id))
      setBook(b || null)
    })
  }, [id])

  if (!book) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 h-11 flex items-center px-4 gap-3 flex-shrink-0">
        <Link to={`/books/${id}`} className="btn-ghost py-1 px-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <span className="text-sm font-medium text-gray-700 truncate">{book.title}</span>
        <span className="text-xs text-gray-400 ml-auto">{book.author}</span>
      </header>

      {book.file_format === 'epub' && <EpubReader bookId={id} title={book.title} />}
      {book.file_format === 'pdf' && <PdfReader bookId={id} />}
      {book.file_format !== 'epub' && book.file_format !== 'pdf' && (
        <UnsupportedReader format={book.file_format} />
      )}
    </div>
  )
}
