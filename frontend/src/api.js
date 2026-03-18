const BASE = '/api'

export async function fetchBooks(query = '', format = '') {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (format) params.set('format', format)
  const res = await fetch(`${BASE}/books?${params}`)
  if (!res.ok) throw new Error('Failed to fetch books')
  return res.json()
}

export async function uploadBook(file, onProgress) {
  const form = new FormData()
  form.append('file', file)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/books`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status === 201) resolve(JSON.parse(xhr.responseText))
      else reject(new Error(JSON.parse(xhr.responseText)?.detail || 'Upload failed'))
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send(form)
  })
}

export async function updateBook(id, data) {
  const res = await fetch(`${BASE}/books/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update book')
  return res.json()
}

export async function deleteBook(id) {
  const res = await fetch(`${BASE}/books/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete book')
}

export async function sendBook(id, readerEmail) {
  const res = await fetch(`${BASE}/send/${id}`, {
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
  const res = await fetch(`${BASE}/settings`)
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export function downloadUrl(id) {
  return `${BASE}/books/${id}/download`
}

// Metadata providers
export async function searchMetadata(query) {
  const res = await fetch(`${BASE}/metadata/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Metadata search failed')
  return res.json()
}

export async function applyMetadata(bookId, data) {
  const res = await fetch(`${BASE}/metadata/${bookId}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to apply metadata')
}

// Format conversion
export async function convertBook(bookId, targetFormat) {
  const res = await fetch(`${BASE}/convert/${bookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_format: targetFormat }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Conversion failed')
  }
  // Trigger download
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const cd = res.headers.get('content-disposition') || ''
  const m = cd.match(/filename="([^"]+)"/)
  a.download = m ? m[1] : `book.${targetFormat}`
  a.click()
  URL.revokeObjectURL(url)
}

// Calibre import
export async function importCalibre(calibrePath) {
  const res = await fetch(`${BASE}/library/import-calibre`, {
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
