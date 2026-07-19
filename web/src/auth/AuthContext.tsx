import { useCallback, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { session, type SessionUser } from '../api/client'
import { login as loginRequest } from '../api/auth'
import { AuthContext, useAuth } from './useAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Session is read from localStorage once; the token survives reloads.
  const [user, setUser] = useState<SessionUser | null>(() =>
    session.token ? session.user : null,
  )

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password)
    session.save(result.token, result.user)
    setUser(result.user)
  }, [])

  const logout = useCallback(() => {
    session.clear()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Route guard: unauthenticated visits bounce to /login (remembering where they came from). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    // Keep the query string too — filters live in the URL, so "where the user
    // was headed" includes them.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}
