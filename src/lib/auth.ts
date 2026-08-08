// Auth + system-config store. Separate from the product store (store.ts) so the
// login session and feature flags persist independently of the Linear data.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { api, setApiToken } from './api'
import { resetWorkspaceStore } from './resetWorkspace'

// During SSR/prerender there is no localStorage — fall back to a no-op store so
// the persist middleware can initialise without throwing in Node.
const memoryStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export type AuthRole = 'admin' | 'member' | 'guest'

export interface AuthUser {
  id: string
  name: string
  email: string
  avatarColor: string
  role: AuthRole
  status: 'active' | 'suspended'
  createdAt: string
}

export interface FeatureFlag {
  key: string
  label: string
  description: string
  enabled: boolean
  position: number
}

export interface WorkspaceConfig {
  name?: string
  tagline?: string
  accentColor?: string
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  flags: Record<string, boolean>
  workspace: WorkspaceConfig
  /** Bootstrap (config fetch + token validation) finished. */
  ready: boolean
  loading: boolean
  error: string | null

  bootstrap: () => Promise<void>
  refreshConfig: () => Promise<void>
  login: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string) => Promise<boolean>
  /** Passwordless: email a one-time code. Works for both sign-in and sign-up. */
  requestOtp: (email: string, name?: string) => Promise<boolean>
  /** Passwordless: exchange the code for a session. `remember` → 90-day token. */
  verifyOtp: (email: string, code: string, remember: boolean, name?: string) => Promise<boolean>
  logout: () => void
  /** Optimistically reflect an admin flag toggle without a refetch. */
  applyFlag: (key: string, enabled: boolean) => void
  setWorkspace: (ws: WorkspaceConfig) => void
}

function flagsToRecord(flags: FeatureFlag[]): Record<string, boolean> {
  return Object.fromEntries(flags.map((f) => [f.key, f.enabled]))
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      flags: {},
      workspace: {},
      ready: false,
      loading: false,
      error: null,

      bootstrap: async () => {
        // Public config (flags + workspace) is always fetched so the landing
        // page and gated sidebar reflect the latest system state.
        try {
          const cfg = await api<{ workspace: WorkspaceConfig; flags: FeatureFlag[] }>('/config', {
            auth: false,
          })
          set({ flags: flagsToRecord(cfg.flags), workspace: cfg.workspace })
        } catch {
          // Backend unreachable — fall back to whatever was persisted.
        }
        // Validate a persisted token; drop it if the account is gone/suspended.
        if (get().token) {
          try {
            const { user } = await api<{ user: AuthUser }>('/auth/me')
            set({ user })
          } catch {
            setApiToken(null)
            set({ token: null, user: null })
          }
        }
        set({ ready: true })
      },

      refreshConfig: async () => {
        const cfg = await api<{ workspace: WorkspaceConfig; flags: FeatureFlag[] }>('/config', {
          auth: false,
        })
        set({ flags: flagsToRecord(cfg.flags), workspace: cfg.workspace })
      },

      login: async (email, password) => {
        set({ loading: true, error: null })
        try {
          const { token, user } = await api<{ token: string; user: AuthUser }>('/auth/login', {
            method: 'POST',
            body: { email, password },
            auth: false,
          })
          setApiToken(token)
          set({ token, user, loading: false })
          // Pull fresh flags now that we're authenticated.
          get().refreshConfig().catch(() => {})
          return true
        } catch (e) {
          set({ loading: false, error: e instanceof Error ? e.message : 'Login failed' })
          return false
        }
      },

      register: async (name, email, password) => {
        set({ loading: true, error: null })
        try {
          const { token, user } = await api<{ token: string; user: AuthUser }>('/auth/register', {
            method: 'POST',
            body: { name, email, password },
            auth: false,
          })
          setApiToken(token)
          set({ token, user, loading: false })
          get().refreshConfig().catch(() => {})
          return true
        } catch (e) {
          set({ loading: false, error: e instanceof Error ? e.message : 'Registration failed' })
          return false
        }
      },

      requestOtp: async (email, name) => {
        set({ loading: true, error: null })
        try {
          await api('/auth/otp/request', {
            method: 'POST',
            body: { email, name },
            auth: false,
          })
          set({ loading: false })
          return true
        } catch (e) {
          set({ loading: false, error: e instanceof Error ? e.message : 'Không gửi được mã' })
          return false
        }
      },

      verifyOtp: async (email, code, remember, name) => {
        set({ loading: true, error: null })
        try {
          const { token, user } = await api<{ token: string; user: AuthUser }>('/auth/otp/verify', {
            method: 'POST',
            body: { email, code, remember, name },
            auth: false,
          })
          setApiToken(token)
          set({ token, user, loading: false })
          get().refreshConfig().catch(() => {})
          return true
        } catch (e) {
          set({ loading: false, error: e instanceof Error ? e.message : 'Xác thực thất bại' })
          return false
        }
      },

      logout: () => {
        setApiToken(null)
        set({ token: null, user: null })
        // Drop the workspace data too — it belongs to the account that just
        // left, not to this browser.
        resetWorkspaceStore()
      },

      applyFlag: (key, enabled) => set((s) => ({ flags: { ...s.flags, [key]: enabled } })),
      setWorkspace: (ws) => set({ workspace: ws }),
    }),
    {
      name: 'flint-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : memoryStorage,
      ),
      // Only the session + last-known config are persisted; `ready`/`loading`
      // are recomputed on every boot.
      partialize: (s) => ({
        token: s.token,
        user: s.user,
        flags: s.flags,
        workspace: s.workspace,
      }),
      onRehydrateStorage: () => (state) => {
        // Re-arm the api client with the rehydrated token before bootstrap runs.
        if (state?.token) setApiToken(state.token)
      },
    },
  ),
)

/** Convenience hook: is a feature enabled? Unknown keys default to enabled. */
export function useFeature(key: string): boolean {
  return useAuth((s) => s.flags[key] ?? true)
}
