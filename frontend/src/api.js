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
