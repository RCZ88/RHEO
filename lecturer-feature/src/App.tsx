import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Layers, ScanSearch, Mic, Globe2, Sparkles, KeyRound, FlaskConical } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Decks from './pages/Decks';
import SlideViewer from './pages/SlideViewer';
import ImageLab from './pages/ImageLab';
import Transcriber from './pages/Transcriber';
import WebDigest from './pages/WebDigest';
import PromptForge from './pages/PromptForge';
import AuthVault from './pages/AuthVault';
import Research from './pages/Research';
const mobile = [
  { to: '/', icon: LayoutDashboard }, { to: '/decks', icon: Layers }, { to: '/image-lab', icon: ScanSearch }, { to: '/transcriber', icon: Mic },
  { to: '/web-digest', icon: Globe2 }, { to: '/prompts', icon: Sparkles }, { to: '/auth-vault', icon: KeyRound }, { to: '/research', icon: FlaskConical },
];
export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#080a12] text-white flex">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <div className="md:hidden sticky top-0 z-20 border-b border-white/10 bg-[#0b0d16]/95 backdrop-blur px-4 py-3 flex items-center justify-between">
            <div className="font-display font-bold">SlideMind</div>
            <div className="text-[10px] text-emerald-300 font-mono">token-saver on</div>
          </div>
          <main className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto pb-24 md:pb-10">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/decks" element={<Decks />} />
              <Route path="/decks/:id" element={<SlideViewer />} />
              <Route path="/image-lab" element={<ImageLab />} />
              <Route path="/transcriber" element={<Transcriber />} />
              <Route path="/web-digest" element={<WebDigest />} />
              <Route path="/prompts" element={<PromptForge />} />
              <Route path="/auth-vault" element={<AuthVault />} />
              <Route path="/research" element={<Research />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-white/10 bg-[#0b0d16]/95 backdrop-blur px-2 py-2 grid grid-cols-8 gap-1">
            {mobile.map(m => <NavLink key={m.to} to={m.to} end={m.to === '/'} className={({ isActive }) => 'grid place-items-center py-2 rounded-xl ' + (isActive ? 'bg-white/10 text-white' : 'text-white/40')}><m.icon className="w-5 h-5" /></NavLink>)}
          </nav>
        </div>
      </div>
    </BrowserRouter>
  );
}
