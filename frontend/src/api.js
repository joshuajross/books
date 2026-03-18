const BASE = '/api'

function getToken() {
  return localStorage.getItem('bookshelf_token')
}

function authHeaders(extra = {}) {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}`, ...extra } : extra
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  })
  if (res.status === 401) {
    // Token expired or invalid — boot to login
    localStorage.removeItem('bookshelf_token')
    window.location.href = '/login'
    throw new Error('Session expired')
  }
  return res
}

export async function fetchBooks(query = '', format = '') {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (format) params.set('format', format)
  const res = await apiFetch(`${BASE}/books?${params}`)
  if (!res.ok) throw new Error('Failed to fetch books')
  return res.json()
}

export async function uploadBook(file, onProgress) {
  const form = new FormData()
  form.append('file', file)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/books`)
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status === 401) {
        localStorage.removeItem('bookshelf_token')
        window.location.href = '/login'
        reject(new Error('Session expired'))
      } else if (xhr.status === 201) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        reject(new Error(JSON.parse(xhr.responseText)?.detail || 'Upload failed'))
      }
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send(form)
  })
}

export async function updateBook(id, data) {
  const res = await apiFetch(`${BASE}/books/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update book')
  return res.json()
}

export async function deleteBook(id) {
  const res = await apiFetch(`${BASE}/books/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete book')
}

export async function sendBook(id, readerEmail) {
  const res = await apiFetch(`${BASE}/send/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reader_email: readerEmail }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to send book')
  }
}

export async function fetchSettings() {
  const res = await apiFetch(`${BASE}/settings`)
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export function downloadUrl(id) {
  return `${BASE}/books/${id}/download`
}

// Metadata providers
export async function searchMetadata(query) {
  const res = await apiFetch(`${BASE}/metadata/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Metadata search failed')
  return res.json()
}

export async function applyMetadata(bookId, data) {
  const res = await apiFetch(`${BASE}/metadata/${bookId}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to apply metadata')
}

// SMTP admin
export async function fetchSmtpConfig() {
  const res = await apiFetch(`${BASE}/settings/smtp`)
  if (!res.ok) throw new Error('Failed to fetch SMTP config')
  return res.json()
}

export async function saveSmtpConfig(config) {
  const res = await apiFetch(`${BASE}/settings/smtp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to save SMTP config')
  }
}

export async function testSmtp() {
  const res = await apiFetch(`${BASE}/settings/smtp/test`, { method: 'POST' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'SMTP test failed')
  }
}

// Calibre import
export async function importCalibre(calibrePath) {
  const res = await apiFetch(`${BASE}/library/import-calibre`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calibre_path: calibrePath }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Import failed')
  }
  return res.json()
}
