import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Upload as UploadIcon, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react'
import { uploadBook } from '../api'

const ACCEPTED = {
  'application/epub+zip': ['.epub'],
  'application/pdf': ['.pdf'],
  'application/x-mobipocket-ebook': ['.mobi'],
  'application/vnd.amazon.ebook': ['.azw', '.azw3'],
  'application/octet-stream': ['.fb2', '.cbz', '.cbr'],
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function FileItem({ file, status, progress, error }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
        {status === 'uploading' && (
          <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </div>
      <div className="flex-shrink-0">
        {status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-brand-500" />}
        {status === 'done' && <CheckCircle className="w-4 h-4 text-green-500" />}
        {status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
      </div>
    </div>
  )
}

export default function Upload() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])

  const onDrop = useCallback(async (accepted) => {
    if (!accepted.length) return
    const entries = accepted.map((file) => ({
      file,
      status: 'pending',
      progress: 0,
      error: '',
    }))
    setQueue((prev) => [...prev, ...entries])

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const idx = queue.length + i

      setQueue((prev) =>
        prev.map((e, j) => (j === idx ? { ...e, status: 'uploading' } : e))
      )
      try {
        await uploadBook(entry.file, (pct) => {
          setQueue((prev) =>
            prev.map((e, j) => (j === idx ? { ...e, progress: pct } : e))
          )
        })
        setQueue((prev) =>
          prev.map((e, j) => (j === idx ? { ...e, status: 'done', progress: 100 } : e))
        )
      } catch (err) {
        setQueue((prev) =>
          prev.map((e, j) => (j === idx ? { ...e, status: 'error', error: err.message } : e))
        )
      }
    }
  }, [queue.length])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  })

  const allDone = queue.length > 0 && queue.every((e) => e.status === 'done' || e.status === 'error')

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Upload Books</h1>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${isDragActive
            ? 'border-brand-500 bg-brand-50'
            : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
          }`}
      >
        <input {...getInputProps()} />
        <UploadIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600">
          {isDragActive ? 'Drop your books here' : 'Drag & drop ebooks here'}
        </p>
        <p className="text-xs text-gray-400 mt-1">or click to browse</p>
        <p className="text-xs text-gray-300 mt-3">EPUB · PDF · MOBI · AZW3 · FB2 · CBZ</p>
      </div>

      {queue.length > 0 && (
        <div className="card mt-4 divide-y divide-gray-50 px-4">
          {queue.map((entry, i) => (
            <FileItem key={i} {...entry} />
          ))}
        </div>
      )}

      {allDone && (
        <div className="mt-4 flex gap-3 justify-end">
          <button className="btn-ghost" onClick={() => setQueue([])}>
            Upload more
          </button>
          <button className="btn-primary" onClick={() => navigate('/')}>
            Go to library
          </button>
        </div>
      )}
    </div>
  )
}
