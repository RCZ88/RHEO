import { toolRegistry } from './toolRegistry'
const api = (window as any).deskflowAPI
toolRegistry.register({ name:'addCanvasCard', description:'Add a card to the AI canvas (deck)', securityLevel:'read', category:'canvas', parameters:{ title:{type:'string',description:'Card title',required:true}, body:{type:'string',description:'Markdown body'}, kind:{type:'string',description:'note|task|metric|digest'} }, handler: async (p) => { window.dispatchEvent(new CustomEvent('deskflow:ai-canvas-add', { detail: p })); return { ok:true, queued:true }; } })
