const g: any = globalThis as any;
g.window = g.window ?? {};
g.window.deskflowAPI = new Proxy({}, { get: () => async () => ({}) });
g.localStorage = g.localStorage ?? { _d: {}, getItem(k: string) { return this._d[k] ?? null; }, setItem(k: string, v: any) { this._d[k] = String(v); }, removeItem(k: string) { delete this._d[k]; } };
