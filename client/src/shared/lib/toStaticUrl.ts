const DEFAULT_SERVER_URL = "http://localhost:3001";

export function toStaticUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const base =
    import.meta.env.VITE_STATIC_URL ||
    import.meta.env.VITE_SOCKET_URL ||
    DEFAULT_SERVER_URL;

  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

