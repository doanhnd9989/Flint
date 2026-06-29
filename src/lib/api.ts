// Thin fetch wrapper for the auth/admin backend. The bearer token is held in a
// module variable (set by the auth store) to avoid an import cycle.
let authToken: string | null = null

export function setApiToken(token: string | null) {
  authToken = token
}

export interface ApiOptions {
  method?: string
  body?: unknown
  /** Attach the bearer token (default true). */
  auth?: boolean
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`

  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Cannot reach the server. Check your connection.')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  }
  return data as T
}
