import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type AuthUser = { id: string; email: string | null; phone: string | null; displayName: string; roles: string[] };
type AuthResponse = { user?: AuthUser; message?: string };
type AuthContextValue = { user: AuthUser | null; loading: boolean; error: string | null; signIn: (identifier: string, password: string) => Promise<AuthUser>; signUp: (displayName: string, phone: string, email: string, password: string, confirmPassword: string) => Promise<AuthUser>; forgotPassword: (email: string) => Promise<string>; resetPassword: (token: string, password: string, confirmPassword: string) => Promise<void>; signInWithGoogle: (idToken: string) => Promise<void>; logout: () => Promise<void>; clearError: () => void };
const AuthContext = createContext<AuthContextValue | null>(null);
const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/v1`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrf, setCsrf] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const getCsrf = async () => { const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: "include" }); const body = await response.json() as { csrfToken: string }; setCsrf(body.csrfToken); return body.csrfToken; };
  const request = async (path: string, options: RequestInit = {}) => { const token = csrf || await getCsrf(); const response = await fetch(`${API_BASE}${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": token, ...(options.headers ?? {}) } }); if (!response.ok) { const body = await response.json().catch(() => null) as { error?: { code?: string } } | null; throw new Error(body?.error?.code ?? "REQUEST_FAILED"); } return response.status === 204 ? null : response.json() as Promise<AuthResponse>; };
  const validateSession = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/me`, { credentials: "include", cache: "no-store" });
      if (!response.ok) { setUser(null); return null; }
      const body = await response.json() as { user: AuthUser };
      setUser(body.user);
      return body.user;
    } finally {
      if (showLoading) setLoading(false);
    }
  };
  const broadcastLogout = () => { const message = JSON.stringify({ type: "logout", at: Date.now() }); window.localStorage.setItem("guidemytrip-auth-event", message); window.localStorage.removeItem("guidemytrip-auth-event"); };
  useEffect(() => { let mounted = true; const initialize = async () => { try { await getCsrf(); if (mounted) await validateSession(true); } catch { if (mounted) setUser(null); } finally { if (mounted) setLoading(false); } }; void initialize(); const onLogoutSignal = () => { setUser(null); setError(null); sessionStorage.removeItem("guidemytrip-booking"); if (window.location.pathname !== "/") window.location.replace("/"); }; const onStorage = (event: StorageEvent) => { if (event.key === "guidemytrip-auth-event" && event.newValue) onLogoutSignal(); }; const onPageShow = () => { void validateSession(true); }; const onVisibility = () => { if (document.visibilityState === "visible") void validateSession(true); }; const channel = "BroadcastChannel" in window ? new BroadcastChannel("guidemytrip-auth") : null; channel?.addEventListener("message", (event: MessageEvent<{ type?: string }>) => { if (event.data?.type === "logout") onLogoutSignal(); }); window.addEventListener("storage", onStorage); window.addEventListener("pageshow", onPageShow); window.addEventListener("guidemytrip-session-expired", onLogoutSignal); document.addEventListener("visibilitychange", onVisibility); return () => { mounted = false; channel?.close(); window.removeEventListener("storage", onStorage); window.removeEventListener("pageshow", onPageShow); window.removeEventListener("guidemytrip-session-expired", onLogoutSignal); document.removeEventListener("visibilitychange", onVisibility); }; }, []);
  const run = async (operation: () => Promise<AuthResponse | null>) => { setError(null); const result = await operation(); if (result?.user) setUser(result.user); return result; };
  const withError = async (operation: () => Promise<AuthResponse | null>, fallback: string) => { try { return (await run(operation))?.user; } catch (caught) { setError(caught instanceof Error ? caught.message : fallback); throw caught; } };
  const value = useMemo<AuthContextValue>(() => ({ user, loading, error, clearError: () => setError(null), signIn: async (identifier, password) => (await withError(() => request("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) }), "Sign in failed"))!, signUp: async (displayName, phone, email, password, confirmPassword) => (await withError(() => request("/auth/signup", { method: "POST", body: JSON.stringify({ displayName, phone, email, password, confirmPassword }) }), "Sign up failed"))!, forgotPassword: async (email) => { try { const result = await run(() => request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) })); return result?.message ?? "If an account exists with the provided email address, you will receive instructions to reset your password."; } catch (caught) { setError(caught instanceof Error ? caught.message : "Password reset request failed"); throw caught; } }, resetPassword: async (token, password, confirmPassword) => { await withError(() => request("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password, confirmPassword }) }), "Password reset failed"); }, signInWithGoogle: async (idToken) => { await withError(() => request("/auth/google", { method: "POST", body: JSON.stringify({ idToken }) }), "Google sign in failed"); }, logout: async () => { try { await request("/auth/logout", { method: "POST" }); } catch (caught) { setError("LOGOUT_FAILED"); throw caught; } finally { setUser(null); sessionStorage.removeItem("guidemytrip-booking"); broadcastLogout(); } } }), [csrf, error, loading, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
