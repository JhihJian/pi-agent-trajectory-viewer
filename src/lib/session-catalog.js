// Session catalog logic, adapted from the codex-session-renderer session
// sidebar (public/controllers/sessions.js and public/views/sessions.js):
// multi-word search over session metadata and date-grouped listing.

const firstLineOf = (value, limit = 160) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)

export function matchesSession(session, query) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return true
  const haystack = [session.title, session.cwd, session.model, session.id, session.sourceId].filter(Boolean).join(' ').toLowerCase()
  return needle.split(/\s+/).every((word) => haystack.includes(word))
}

export function sessionActivity(session) {
  return session.updatedAt ?? session.startedAt ?? 0
}

export function sessionSizeLabel(bytes) {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`
}

export function dateLabel(timestamp) {
  if (!timestamp) return 'Undated'
  return new Date(timestamp).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

// Groups sessions per source into date groups, newest activity first.
export function groupSessions(sessions, { query = '' } = {}) {
  const bySource = new Map()
  for (const session of [...sessions].sort((a, b) => sessionActivity(b) - sessionActivity(a))) {
    if (!matchesSession(session, query)) continue
    if (!bySource.has(session.sourceId)) bySource.set(session.sourceId, [])
    const groups = bySource.get(session.sourceId)
    const label = dateLabel(sessionActivity(session))
    const group = groups.at(-1)
    if (group && group.label === label) group.sessions.push(session)
    else groups.push({ label, sessions: [session] })
  }
  return bySource
}

export function sessionPreview(session) {
  return firstLineOf(session.title || session.cwd || session.id)
}
