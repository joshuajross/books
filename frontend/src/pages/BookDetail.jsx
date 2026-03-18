import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Download, Send, Trash2, Edit2, Check, X,
  BookOpen, Loader2, Sparkles, BookMarked,
} from 'lucide-react'
import { fetchBooks, updateBook, deleteBook, sendBook, downloadUrl, fetchSettings } from '../api'
import MetadataSearch from '../components/MetadataSearch'

function Field({ label, value, editing, name, onChange }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
      {editing ? (
        <input className="input mt-1" name={name} defaultValue={value} onChange={onChange} />
      ) : (
        <p className="text-sm text-gray-700 mt-0.5">{value || <span className="text-gray-300">—</span>}</p>
      )}
    </div>
  )
}

export default function BookDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [showMeta, setShowMeta] = useState(false)
  const [readerEmail, setReaderEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState('')
  const [emailConfigured, setEmailConfigured] = useState(false)

  const loadBook = () =>
    fetchBooks().then((books) => books.find((b) => b.id === Number(id)))

  useEffect(() => {
    Promise.all([loadBook(), fetchSettings()]).then(([b, settings]) => {
      if (!b) { navigate('/'); return }
      setBook(b)
      setEmailConfigured(settings.email_configured)
      setLoading(false)
    })
  }, [id, navigate])

  const handleEdit = () => { setEditData({ ...book }); setEditing(true) }
  const handleChange = (e) => setEditData((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateBook(book.id, editData)
      setBook(updated)
      setEditing(false)
    } catch { alert('Failed to save.') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try { await deleteBook(book.id); navigate('/') }
    catch { alert('Failed to delete.'); setDeleting(false) }
  }

  const handleSend = async () => {
    if (!readerEmail) return
    setSending(true); setSendStatus('')
    try { await sendBook(book.id, readerEmail); setSendStatus('success') }
    catch (err) { setSendStatus(err.message) }
    finally { setSending(false) }
  }

  const handleMetaApplied = async () => {
    const updated = await loadBook()
    if (updated) setBook(updated)
    setShowMeta(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/" className="btn-ghost mb-6 inline-flex">
        <ArrowLeft className="w-4 h-4" /> Back to library
      </Link>

      <div className="card p-6">
        <div className="flex gap-6">
          {/* Cover */}
          <div className="w-28 h-40 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
            {book.cover_path ? (
              <img src={book.cover_path} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <BookOpen className="w-10 h-10 text-gray-300" />
            )}
          </div>

          {/* Header */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input className="input text-lg font-semibold" name="title" defaultValue={book.title} onChange={handleChange} />
            ) : (
              <h1 className="text-xl font-semibold text-gray-900">{book.title}</h1>
            )}
            {editing ? (
              <input className="input mt-2" name="author" defaultValue={book.author} onChange={handleChange} />
            ) : (
              <p className="text-gray-500 mt-1">{book.author}</p>
            )}
            <span className="inline-block mt-2 text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {book.file_format.toUpperCase()}
            </span>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 mt-4">
              {editing ? (
                <>
                  <button className="btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save
                  </button>
                  <button className="btn-ghost" onClick={() => setEditing(false)}>
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </>
              ) : (
                <>
                  {(book.file_format === 'epub' || book.file_format === 'pdf') && (
                    <Link to={`/books/${book.id}/read`} className="btn-primary">
                      <BookMarked className="w-4 h-4" /> Read
                    </Link>
                  )}
                  <a href={downloadUrl(book.id)} download className="btn-ghost">
                    <Download className="w-4 h-4" /> Download
                  </a>
                  <button className="btn-ghost" onClick={() => { setShowSend(!showSend); setShowMeta(false) }}>
                    <Send className="w-4 h-4" /> Send to eReader
                  </button>
                  <button className="btn-ghost" onClick={() => { setShowMeta(!showMeta); setShowSend(false) }}>
                    <Sparkles className="w-4 h-4" /> Fetch Metadata
                  </button>
                  <button className="btn-ghost" onClick={handleEdit}>
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Send to eReader panel */}
        {showSend && (
          <div className="mt-6 p-4 bg-brand-50 rounded-lg border border-brand-100">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Send to eReader</h3>
            {!emailConfigured && (
              <p className="text-xs text-amber-600 mb-2">
                ⚠ SMTP not configured. Set <code>SMTP_USER</code> and <code>SMTP_PASSWORD</code>.
              </p>
            )}
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="email"
                placeholder="user@kindle.com or user@kobo.com"
                value={readerEmail}
                onChange={(e) => setReaderEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button className="btn-primary flex-shrink-0" onClick={handleSend} disabled={sending || !readerEmail}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>
            {sendStatus === 'success' && <p className="text-xs text-green-600 mt-2">✓ Sent successfully!</p>}
            {sendStatus && sendStatus !== 'success' && <p className="text-xs text-red-500 mt-2">{sendStatus}</p>}
            <p className="text-xs text-gray-400 mt-2">
              Kindle: use your <em>@kindle.com</em> address. Kobo: use Send to Kobo.
            </p>
          </div>
        )}

        {/* Metadata search */}
        {showMeta && <MetadataSearch book={book} onApplied={handleMetaApplied} />}

        {/* Metadata grid */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Field label="Publisher" value={editing ? editData.publisher : book.publisher} editing={editing} name="publisher" onChange={handleChange} />
          <Field label="Language" value={editing ? editData.language : book.language} editing={editing} name="language" onChange={handleChange} />
          <Field label="ISBN" value={editing ? editData.isbn : book.isbn} editing={editing} name="isbn" onChange={handleChange} />
          <Field label="Tags" value={editing ? editData.tags : book.tags} editing={editing} name="tags" onChange={handleChange} />
        </div>

        {(book.description || editing) && (
          <div className="mt-4">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Description</label>
            {editing ? (
              <textarea className="input mt-1 h-24 resize-none" name="description" defaultValue={book.description} onChange={handleChange} />
            ) : (
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{book.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
