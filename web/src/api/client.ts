/**
 * Thin fetch wrapper: attaches the Bearer token, parses JSON, and normalizes
 * failures into ApiError. On a 401 from any authenticated endpoint the stored
 * session is cleared and the app redirects to /login (the mock token never
 * expires, but the guard keeps the app honest if the header is lost/corrupted).
 */

const TOKEN_KEY = 'hopae.token'
const USER_KEY = 'hopae.user'

export interface SessionUser {
  id: string
  name: string
  email: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly payload: unknown

  constructor(status: number, code: string, message: string, payload: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.payload = payload
  }
}

export const session = {
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },
  get user(): SessionUser | null {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as SessionUser
    } catch {
      return null
    }
  },
  save(token: string, user: SessionUser): void {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
  /** Skip the automatic logout-on-401 (used by the login call itself). */
  anonymous?: boolean
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (!options.anonymous && session.token) {
    headers['Authorization'] = `Bearer ${session.token}`
  }

  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'network_error', 'Could not reach the server. Is the mock server running?', null)
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && !options.anonymous) {
      session.clear()
      window.location.assign('/login?reason=session')
    }
    const body = (payload ?? {}) as { error?: string; message?: string }
    throw new ApiError(
      response.status,
      body.error ?? `http_${response.status}`,
      body.message ?? body.error ?? `Request failed (${response.status})`,
      payload,
    )
  }

  return payload as T
}
