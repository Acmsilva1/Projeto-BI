const sanitizeBaseUrl = (input: string): string => {
  if (!input) return "";
  return input.trim().replace(/\/+$/, "");
};

export const API_BASE_URL = sanitizeBaseUrl(import.meta.env.VITE_API_URL ?? "");

export const buildApiUrl = (path: string): string => {
  if (!path) return API_BASE_URL || "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE_URL) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
