import { Routes, Route, Navigate } from 'react-router-dom';
import SlideSidebar from './components/SlideSidebar';
import Dashboard from './pages/Dashboard';
import Decks from './pages/Decks';
import SlideViewer from './pages/SlideViewer';
import ImageLab from './pages/ImageLab';
import Transcriber from './pages/Transcriber';
import WebDigest from './pages/WebDigest';
import PromptForge from './pages/PromptForge';
import AuthVault from './pages/AuthVault';
import Research from './pages/Research';

console.log('%c[LectureWorkspace] v1.0 loaded', 'color: #fbbf24; font-weight: bold');

export default function LectureWorkspace() {
  return (
    <div className="min-h-full flex bg-[#080a12] text-white">
      <SlideSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar (from lecturer App.tsx) */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0b0d16]/90 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-300 via-orange-500 to-violet-600 grid place-items-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <div className="font-display font-bold text-[15px] tracking-tight text-white">SlideMind</div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-300 font-mono">token-saver on</span>
          </div>
        </div>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto w-full pb-24 md:pb-10">
          <Routes>
            <Route path="" element={<Dashboard />} />
            <Route path="decks" element={<Decks />} />
            <Route path="decks/:id" element={<SlideViewer />} />
            <Route path="image-lab" element={<ImageLab />} />
            <Route path="transcriber" element={<Transcriber />} />
            <Route path="web-digest" element={<WebDigest />} />
            <Route path="prompts" element={<PromptForge />} />
            <Route path="auth-vault" element={<AuthVault />} />
            <Route path="research" element={<Research />} />
            <Route path="*" element={<Navigate to="/lecture" replace />} />
          </Routes>
        </main>
        {/* Mobile bottom nav (from lecturer App.tsx) */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-8 border-t border-white/10 bg-[#0b0d16]/95 backdrop-blur-xl">
          {[
            { to: '/lecture', label: 'Home' },
            { to: '/lecture/decks', label: 'Decks' },
            { to: '/lecture/image-lab', label: 'OCR' },
            { to: '/lecture/transcriber', label: 'STT' },
            { to: '/lecture/web-digest', label: 'Web' },
            { to: '/lecture/prompts', label: 'Forge' },
            { to: '/lecture/auth-vault', label: 'Vault' },
            { to: '/lecture/research', label: 'R&D' },
          ].map(it => (
            <a key={it.to} href={'#' + it.to} className="py-2.5 text-center text-[9px] text-white/60 active:text-amber-300">
              {it.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
