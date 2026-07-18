import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import { AuthProvider, RequireAuth } from './auth/AuthContext'
import { ToastProvider } from './components/Toast'
import LoginPage from './auth/LoginPage'
import ConsoleLayout from './console/ConsoleLayout'
import TransactionsPage from './transactions/TransactionsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // The list manages its own freshness via refetchInterval; disable the
      // window-focus refetch so returning to the tab doesn't jump the list.
      refetchOnWindowFocus: false,
    },
  },
})

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/:env',
    element: (
      <RequireAuth>
        <ConsoleLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="transactions" replace /> },
      { path: 'transactions', element: <TransactionsPage /> },
    ],
  },
  { path: '/', element: <Navigate to="/sandbox/transactions" replace /> },
  { path: '*', element: <Navigate to="/sandbox/transactions" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
