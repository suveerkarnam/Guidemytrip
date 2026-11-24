const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/v1`;

function readCookie(name: string) { return document.cookie.split("; ").find((part) => part.startsWith(`${name}=`))?.split("=")[1] ?? ""; }

async function csrfToken() { const existing = readCookie("gt_csrf"); if (existing) return existing; const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: "include" }); if (!response.ok) throw new Error("CSRF_BOOTSTRAP_FAILED"); const body = await response.json() as { csrfToken: string }; return body.csrfToken; }

export async function apiFetch<T>(path: string, options: RequestInit = {}) { const method = options.method ?? "GET"; const headers = new Headers(options.headers); if (method !== "GET") { headers.set("Content-Type", "application/json"); headers.set("X-CSRF-Token", await csrfToken()); } const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" }); if (!response.ok) { const body = await response.json().catch(() => null) as { error?: { code?: string } } | null; throw new Error(body?.error?.code ?? "REQUEST_FAILED"); } return response.status === 204 ? null as T : response.json() as Promise<T>; }

export type ApiDestination = { id: string; slug: string; name: string; region: string; description: string; imageUrl: string | null; attractions: Array<{ id: string; name: string; description: string | null }> };
export type ApiLanguage = { id: string; code: string; name: string };
export type ApiPackage = { id: string; slug: string; name: string; description: string; durationDays: number; capacity: number; basePrice: string; gstRate: string; currency: string; images: Array<{ url: string; altText: string | null }>; attractions: Array<{ id: string; name: string; description: string | null }>; inclusions: string[]; exclusions: string[]; cancellationPolicy: { name: string; description: string; freeCancellationHours: number } | null };
export type ApiGuide = { id: string; name: string; photoUrl: string | null; experienceYears: number; languages: Array<{ id: string; name: string }>; rating: number; reviewCount: number; verified: boolean; destination: string; basePrice: string; capacity: number };
