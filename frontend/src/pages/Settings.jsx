import { useState, useEffect } from 'react'
import { Loader2, CheckCircle, XCircle, Database, Rss, RefreshCw } from 'lucide-react'
import { fetchSettings, importCalibre } from '../api'

export default function Settings() {
  const [srvSettings, setSrvSettings] = useState(null)
  const [calibrePath, setCalibrePath] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')

  useEffect(() => {
    fetchSettings().then(setSrvSettings)
  }, [])

  const opdsUrl = `${window.location.origin}/opds`

  const doImport = async () => {
    if (!calibrePath.trim()) return
    setImporting(true)
    setImportResult(null)
    setImportError('')
    try {
      const result = await importCalibre(calibrePath)
      setImportResult(result)
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* Server capabilities */}
      {srvSettings && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Server Status</h2>
          <ul className="space-y-2">
            {[
              ['Email (Send to eReader)', srvSettings.email_configured],
              ['Google Books API', srvSettings.google_books_configured],
              ['Format Conversion (Calibre)', srvSettings.conversion_available],
            ].map(([label, ok]) => (
              <li key={label} className="flex items-center gap-2 text-sm">
                {ok
                  ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                <span className={ok ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-3">
            Configure via environment variables — see <code>.env.example</code>.
          </p>
        </div>
      )}

      {/* OPDS */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <Rss className="w-4 h-4 text-brand-500" /> OPDS Catalog
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          Point any OPDS-compatible eReader app (KOReader, Moon+ Reader, Panels…) at this URL to browse and download your library directly.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-700 truncate">
            {opdsUrl}
          </code>
          <button
            className="btn-ghost text-xs"
            onClick={() => navigator.clipboard.writeText(opdsUrl)}
          >
            Copy
          </button>
        </div>
      </div>

      {/* Calibre Import */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <Database className="w-4 h-4 text-brand-500" /> Import from Calibre Library
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          Enter the path to your existing Calibre library folder (must contain <code>metadata.db</code>). Books and covers will be copied into BookShelf.
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="/home/user/Calibre Library"
            value={calibrePath}
            onChange={(e) => setCalibrePath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doImport()}
          />
          <button className="btn-primary flex-shrink-0" onClick={doImport} disabled={importing || !calibrePath}>
            {importing
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            Import
          </button>
        </div>
        {importResult && (
          <p className="text-sm text-green-600 mt-2">
            ✓ Imported {importResult.imported} book{importResult.imported !== 1 ? 's' : ''}
            {importResult.skipped > 0 ? `, ${importResult.skipped} already existed` : ''}
            {importResult.errors > 0 ? `, ${importResult.errors} errors` : ''}.
          </p>
        )}
        {importError && (
          <p className="text-sm text-red-500 mt-2">{importError}</p>
        )}
      </div>
    </div>
  )
}
