// Ported from lecturer-feature/src/lib/api.ts — fetch → IPC (lecture:api / lecture:digest).
// Pages keep calling api.get/post/put/del with '/api/...' paths; the backend
// service (src/services/lecture/index.ts) parses the same route shapes.
const w = window as any;

async function digestViaIpc(path: string): Promise<any> {
  const m = path.match(/[?&]url=([^&]+)/);
  const url = m ? decodeURIComponent(m[1]) : '';
  const res = await w.deskflowAPI.lectureDigest(url);
  if (res && res.error) throw new Error(String(res.error));
  return res;
}

const req = async (path: string, opts: { method?: string; body?: any } = {}): Promise<any> => {
  const method = opts.method || 'get';
  if (method === 'get' && path.startsWith('/api/digest')) return digestViaIpc(path);
  const res = await w.deskflowAPI.lectureApi({ method, path, body: opts.body });
  if (res && res.error) throw new Error(String(res.error));
  return res;
};

const api = {
  get: (p: string) => req(p, { method: 'get' }),
  post: (p: string, b?: any) => req(p, { method: 'post', body: b }),
  put: (p: string, b?: any) => req(p, { method: 'put', body: b }),
  del: (p: string, b?: any) => req(p, { method: 'del', body: b }),
};
export default api;
