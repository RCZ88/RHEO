async function req(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) { const t = await res.text(); throw new Error(t.slice(0, 300) || ('Request failed: ' + res.status)); }
  return res.json();
}
export const api = {
  get: (p: string) => req(p),
  post: (p: string, body: unknown) => req(p, { method: 'POST', body: JSON.stringify(body) }),
  put: (p: string, body: unknown) => req(p, { method: 'PUT', body: JSON.stringify(body) }),
  del: (p: string, body: unknown) => req(p, { method: 'DELETE', body: JSON.stringify(body) }),
};
export default api;
