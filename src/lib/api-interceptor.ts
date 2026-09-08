/**
 * API Fetch Interceptor
 * Allows the frontend (e.g. hosted on Firebase Hosting at absen-nmsa-2a282.web.app)
 * to route all /api/* requests to the live backend server (e.g. on Railway).
 */

export function setupApiInterceptor(): void {
  if (typeof window === "undefined") return;

  const metaEnv = (import.meta as any)?.env || {};
  const envBackendUrl = (metaEnv.VITE_API_URL as string | undefined)?.trim();
  const storedBackendUrl = localStorage.getItem("absen_backend_api_url")?.trim();

  // If on Firebase Hosting (web.app or firebaseapp.com) and no custom URL configured yet,
  // we can use the default Railway production backend if available, or stored backend URL
  let targetBackendUrl = envBackendUrl || storedBackendUrl || "";

  // Auto-detect default live Railway backend if on Firebase Hosting and none specified
  if (!targetBackendUrl && (window.location.hostname.endsWith(".web.app") || window.location.hostname.endsWith(".firebaseapp.com"))) {
    // Check if user previously deployed to Railway or has stored preference
    targetBackendUrl = "https://absen-um.up.railway.app";
  }

  if (targetBackendUrl) {
    const cleanBase = targetBackendUrl.replace(/\/+$/, "");
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (typeof input === "string" && input.startsWith("/api/")) {
        const fullUrl = `${cleanBase}${input}`;
        return originalFetch(fullUrl, init);
      }
      if (input instanceof URL && input.pathname.startsWith("/api/")) {
        const fullUrl = `${cleanBase}${input.pathname}${input.search}`;
        return originalFetch(fullUrl, init);
      }
      return originalFetch(input, init);
    };

    console.log(`[API Interceptor] Routing /api requests to backend: ${cleanBase}`);
  }
}

export function setBackendApiUrl(url: string): void {
  if (typeof window !== "undefined") {
    if (url && url.trim()) {
      localStorage.setItem("absen_backend_api_url", url.trim());
    } else {
      localStorage.removeItem("absen_backend_api_url");
    }
    window.location.reload();
  }
}

export function getBackendApiUrl(): string {
  if (typeof window === "undefined") return "";
  const metaEnv = (import.meta as any)?.env || {};
  return (
    localStorage.getItem("absen_backend_api_url") ||
    (metaEnv.VITE_API_URL as string) ||
    ""
  );
}
