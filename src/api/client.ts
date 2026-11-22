const TOKEN_KEY = "asl-pos-access";
const REFRESH_KEY = "asl-pos-refresh";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function liveMode() {
  return import.meta.env.VITE_POS_LIVE === "1" || import.meta.env.VITE_POS_LIVE === "true";
}

export function apiBase() {
  return (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "/api/v1/pos";
}

export function adminApiBase() {
  return (import.meta.env.VITE_ADMIN_API_BASE as string | undefined)?.replace(/\/$/, "") || "/api/v1/admin/pos";
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

type Opts = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  registerId?: string | null;
  /** Use admin POS prefix instead of till prefix */
  admin?: boolean;
  auth?: boolean;
  /** Required by mutating POS/checkout routes that opt into idempotency */
  idempotencyKey?: string;
};

function qs(query?: Opts["query"]) {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const base = opts.admin ? adminApiBase() : apiBase();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const reg = opts.registerId ?? localStorage.getItem("asl-pos-register");
  if (reg) headers["X-Pos-Register"] = reg;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const res = await fetch(`${base}${path}${qs(opts.query)}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    credentials: "include",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err = (data ?? {}) as { error?: { code?: string; message?: string; details?: unknown }; code?: string; message?: string };
    const code = err.error?.code ?? err.code ?? "REQUEST_FAILED";
    const message = err.error?.message ?? err.message ?? (res.statusText || "Request failed");
    throw new ApiError(res.status, code, message, err.error?.details);
  }

  // Nest router often wraps as { data }
  if (data && typeof data === "object" && "data" in (data as object) && Object.keys(data as object).length <= 3) {
    return (data as { data: T }).data;
  }
  return data as T;
}
