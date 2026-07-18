import { request, type SessionUser } from './client'

export interface LoginResponse {
  token: string
  user: SessionUser
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    anonymous: true,
  })
}
