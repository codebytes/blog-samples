export function apiTarget(environment) {
  const value = environment.API_BASE_URL;
  if (!value) throw new Error("API_BASE_URL is required. Start web through the catalog AppHost.");
  if (!URL.canParse(value)) throw new Error("API_BASE_URL must be an absolute HTTP(S) URL.");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("API_BASE_URL must be an HTTP(S) origin without credentials, path, query, or fragment.");
  }
  return url.origin;
}
