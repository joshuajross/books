import { useState, useEffect } from 'react'
import { Loader2, CheckCircle, XCircle, Database, Rss, RefreshCw, Mail, Send } from 'lucide-react'
import { fetchSettings, importCalibre, fetchSmtpConfig, saveSmtpConfig, testSmtp } from '../api'

function StatusBadge({ ok }) {
  return ok
    ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
    : <XCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
}

function SmtpForm() {
  const [form, setForm] = useState({ smtp_host: '', smtp_port: 587, smtp_user: '', smtp_password: '', smtp_from: '' })
  const [hasPassword, setHasPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [testStatus, setTestStatus] = useState('')

  useEffect(() => {
    fetchSmtpConfig().then((cfg) => {
      setForm({ smtp_host: cfg.smtp_host, smtp_port: cfg.smtp_port, smtp_user: cfg.smtp_user, smtp_password: '', smtp_from: cfg.smtp_from })
      setHasPassword(cfg.has_password)
    })
  }, [])

  const set = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    setSaveStatus('')
    try {
      await saveSmtpConfig(form)
      setSaveStatus('saved')
      if (form.smtp_password) setHasPassword(true)
    } catch (err) {
      setSaveStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestStatus('')
    try {
      await testSmtp()
      setTestStatus('success')
    } catch (err) {
      setTestStatus(err.message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-gray-500 mb-1 block">SMTP Host</label>
          <input className="input" name="smtp_host" value={form.smtp_host} onChange={set} placeholder="smtp.gmail.com" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Port</label>
          <input className="input" name="smtp_port" type="number" value={form.smtp_port} onChange={set} placeholder="587" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Username</label>
          <input className="input" name="smtp_user" value={form.smtp_user} onChange={set} placeholder="you@gmail.com" autoComplete="username" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            Password
            {hasPassword && <span className="ml-1 text-green-600 font-normal">(set — leave blank to keep)</span>}
          </label>
          <input className="input" name="smtp_password" type="password" value={form.smtp_password} onChange={set} placeholder={hasPassword ? '••••••••' : 'App password'} autoComplete="new-password" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">From Address <span className="font-normal text-gray-400">(optional)</span></label>
          <input className="input" name="smtp_from" value={form.smtp_from} onChange={set} placeholder="BookShelf <you@gmail.com>" />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save
        </button>
        <button className="btn-ghost" onClick={handleTest} disabled={testing}>
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Test Email
        </button>
        {saveStatus === 'saved' && <span className="text-xs text-green-600">✓ Saved</span>}
        {saveStatus && saveStatus !== 'saved' && <span className="text-xs text-red-500">{saveStatus}</span>}
      </div>
      {testStatus === 'success' && <p className="text-xs text-green-600">✓ Test email sent to {form.smtp_user}</p>}
      {testStatus && testStatus !== 'success' && <p className="text-xs text-red-500">{testStatus}</p>}
    </div>
  )
}

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
            ].map(([label, ok]) => (
              <li key={label} className="flex items-center gap-2 text-sm">
                <StatusBadge ok={ok} />
                <span className={ok ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SMTP Configuration */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <Mail className="w-4 h-4 text-brand-500" /> Email / SMTP
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Configure an outgoing mail server to enable "Send to eReader". Uses STARTTLS on the specified port.
        </p>
        <SmtpForm />
      </div>

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
          <button className="btn-ghost text-xs" onClick={() => navigator.clipboard.writeText(opdsUrl)}>
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
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
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
        {importError && <p className="text-sm text-red-500 mt-2">{importError}</p>}
      </div>
    </div>
  )
}
