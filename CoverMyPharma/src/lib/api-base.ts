/**
 * FastAPI origin (e.g. http://127.0.0.1:8000). Trailing slashes removed so
 * paths like `/api/parse-pdf` do not become `//api/...` (404 on many servers).
 */
export function getBackendBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

/** Absolute or same-origin path to a backend route. */
export function backendUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getBackendBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
