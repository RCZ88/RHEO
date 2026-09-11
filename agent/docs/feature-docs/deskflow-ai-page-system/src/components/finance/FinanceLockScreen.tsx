import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';
import { Shield, Fingerprint, Eye, EyeOff, AlertCircle, KeyRound, Lock, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { AuroraBackground } from './_fx/AuroraBackground';
import { VaultSeal } from './_fx/VaultSeal';

interface FinanceLockScreenProps {
  onUnlock: (password: string) => Promise<boolean>;
  onSetup: (password: string) => Promise<boolean>;
  onBiometricUnlock?: () => Promise<boolean>;
  isFirstTime: boolean;
  error: string | null;
  attemptsLeft: number;
  maxAttempts?: number;
}

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                    */
/* ------------------------------------------------------------------ */

function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToArrayBuffer(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/* ------------------------------------------------------------------ */
/*  Particles (adapted from Magic UI — no cn() dep)                   */
/* ------------------------------------------------------------------ */

interface ParticleCircle {
  x: number; y: number; translateX: number; translateY: number;
  size: number; alpha: number; targetAlpha: number;
  dx: number; dy: number; magnetism: number;
}

function hexToRgb(hex: string): number[] {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function ParticlesBackground({ color = '#10b981', quantity = 60 }: { color?: string; quantity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const circles = useRef<ParticleCircle[]>([]);
  const mouse = useRef({ x: 0, y: 0 });
  const size = useRef({ w: 0, h: 0 });
  const raf = useRef<number | null>(null);
  const rgb = hexToRgb(color);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    ctxRef.current = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      size.current.w = container.offsetWidth;
      size.current.h = container.offsetHeight;
      canvas.width = size.current.w * dpr;
      canvas.height = size.current.h * dpr;
      canvas.style.width = `${size.current.w}px`;
      canvas.style.height = `${size.current.h}px`;
      ctxRef.current?.scale(dpr, dpr);
      initParticles();
    };

    const initParticles = () => {
      circles.current = [];
      for (let i = 0; i < quantity; i++) {
        circles.current.push({
          x: Math.random() * size.current.w,
          y: Math.random() * size.current.h,
          translateX: 0, translateY: 0,
          size: Math.random() * 1.5 + 0.5,
          alpha: 0,
          targetAlpha: Math.random() * 0.4 + 0.1,
          dx: (Math.random() - 0.5) * 0.15,
          dy: (Math.random() - 0.5) * 0.15,
          magnetism: 0.5 + Math.random() * 3,
        });
      }
    };

    const animate = () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.clearRect(0, 0, size.current.w, size.current.h);

      circles.current.forEach((c, i) => {
        const edge = [
          c.x + c.translateX - c.size,
          size.current.w - c.x - c.translateX - c.size,
          c.y + c.translateY - c.size,
          size.current.h - c.y - c.translateY - c.size,
        ];
        const closest = Math.min(...edge);
        const remap = Math.max(0, ((closest - 0) * (1 - 0)) / (20 - 0) + 0);

        if (remap > 1) {
          c.alpha += 0.015;
          if (c.alpha > c.targetAlpha) c.alpha = c.targetAlpha;
        } else {
          c.alpha = c.targetAlpha * remap;
        }

        c.x += c.dx;
        c.y += c.dy;
        c.translateX += (mouse.current.x / (40 / c.magnetism) - c.translateX) / 50;
        c.translateY += (mouse.current.y / (40 / c.magnetism) - c.translateY) / 50;

        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${rgb.join(',')}, ${c.alpha})`;
        ctx.fill();

        if (c.x < -c.size || c.x > size.current.w + c.size || c.y < -c.size || c.y > size.current.h + c.size) {
          circles.current.splice(i, 1);
          circles.current.push({
            x: Math.random() * size.current.w,
            y: Math.random() * size.current.h,
            translateX: 0, translateY: 0,
            size: Math.random() * 1.5 + 0.5,
            alpha: 0,
            targetAlpha: Math.random() * 0.4 + 0.1,
            dx: (Math.random() - 0.5) * 0.15,
            dy: (Math.random() - 0.5) * 0.15,
            magnetism: 0.5 + Math.random() * 3,
          });
        }
      });

      raf.current = requestAnimationFrame(animate);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.current.x = e.clientX - rect.left - size.current.w / 2;
      mouse.current.y = e.clientY - rect.top - size.current.h / 2;
    };

    resize();
    animate();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [color, quantity]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0" aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated Grid Pattern (adapted from Magic UI)                     */
/* ------------------------------------------------------------------ */

function GridPattern({ width = 50, height = 50, maxOpacity = 0.08 }: { width?: number; height?: number; maxOpacity?: number }) {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: maxOpacity }}>
      <defs>
        <pattern id="vault-grid" width={width} height={height} patternUnits="userSpaceOnUse">
          <path d={`M ${width} 0 L 0 0 0 ${height}`} fill="none" stroke="currentColor" strokeWidth="0.5" className="text-emerald-500" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#vault-grid)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Border Beam (adapted from Magic UI)                               */
/* ------------------------------------------------------------------ */

function BorderBeam({
  size = 100, duration = 6, delay = 0,
  colorFrom = '#10b981', colorTo = '#34d399',
  reverse = false, initialOffset = 0, borderWidth = 2,
}: {
  size?: number; duration?: number; delay?: number;
  colorFrom?: string; colorTo?: string;
  reverse?: boolean; initialOffset?: number; borderWidth?: number;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={{
        padding: `${borderWidth}px`,
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }}
    >
      <motion.div
        className="absolute aspect-square"
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
        }}
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{ repeat: Infinity, ease: 'linear', duration, delay: -delay }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MagicCard — mouse-following orb glow (adapted, no next-themes)    */
/* ------------------------------------------------------------------ */

function MagicCard({ children, className = '', glowFrom = '#10b981', glowTo = '#06b6d4', glowSize = 400, glowBlur = 60, glowOpacity = 0.8 }: {
  children: React.ReactNode; className?: string;
  glowFrom?: string; glowTo?: string; glowSize?: number; glowBlur?: number; glowOpacity?: number;
}) {
  const mouseX = useMotionValue(-glowSize);
  const mouseY = useMotionValue(-glowSize);
  const orbX = useSpring(mouseX, { stiffness: 250, damping: 30, mass: 0.6 });
  const orbY = useSpring(mouseY, { stiffness: 250, damping: 30, mass: 0.6 });
  const orbVisible = useSpring(0, { stiffness: 300, damping: 35 });

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }, [mouseX, mouseY]);

  const handlePointerEnter = useCallback(() => orbVisible.set(glowOpacity), [orbVisible, glowOpacity]);
  const handlePointerLeave = useCallback(() => orbVisible.set(0), [orbVisible]);

  return (
    <motion.div
      className={`group relative isolate overflow-hidden rounded-[inherit] ${className}`}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={{
        background: useMotionTemplate`linear-gradient(#09090b 0 0) padding-box, radial-gradient(${glowSize / 2}px circle at ${mouseX}px ${mouseY}px, ${glowFrom}, ${glowTo}, transparent 100%) border-box`,
      }}
    >
      <div className="absolute inset-px z-20 rounded-[inherit] bg-zinc-950/90" />
      <motion.div
        className="pointer-events-none absolute z-30"
        style={{
          width: glowSize, height: glowSize,
          x: orbX, y: orbY,
          translateX: '-50%', translateY: '-50%',
          borderRadius: 9999,
          filter: `blur(${glowBlur}px)`,
          opacity: orbVisible,
          background: `linear-gradient(90deg, ${glowFrom}, ${glowTo})`,
          mixBlendMode: 'screen',
          willChange: 'transform, opacity',
        }}
      />
      <div className="relative z-40">{children}</div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  ScanLineInput — terminal-style input with scan effect              */
/* ------------------------------------------------------------------ */

function ScanLineInput({
  value, onChange, onKeyDown, placeholder, type = 'text',
  disabled, ref: forwardedRef, icon: Icon, onIconClick,
}: {
  value: string; onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder: string; type?: string; disabled?: boolean;
  ref?: React.Ref<HTMLInputElement>; icon?: React.ElementType; onIconClick?: () => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="relative group/input">
      <input
        ref={forwardedRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-xl px-4 py-3.5 pr-10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed font-mono tracking-wide"
        style={{
          boxShadow: focused ? '0 0 20px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      />
      {/* Scan line */}
      <AnimatePresence>
        {focused && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute left-0 right-0 h-px bg-emerald-400/20"
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {Icon && (
        <button
          type="button"
          onClick={onIconClick}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
        >
          <Icon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AttemptIndicator — shield segments showing remaining tries         */
/* ------------------------------------------------------------------ */

function AttemptIndicator({ attemptsLeft, maxAttempts = 3 }: { attemptsLeft: number; maxAttempts?: number }) {
  const segments = Array.from({ length: maxAttempts }, (_, i) => i < attemptsLeft);

  return (
    <div className="flex items-center gap-1.5">
      {segments.map((active, i) => (
        <motion.div
          key={i}
          className="w-8 h-1.5 rounded-full"
          style={{
            background: active
              ? 'linear-gradient(90deg, #059669, #10b981)'
              : 'linear-gradient(90deg, #7f1d1d, #991b1b)',
            boxShadow: active ? '0 0 8px rgba(16,185,129,0.3)' : 'none',
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function FinanceLockScreen({ onUnlock, onSetup, onBiometricUnlock, isFirstTime, error, attemptsLeft, maxAttempts = 3 }: FinanceLockScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [shake, setShake] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [sealStatus, setSealStatus] = useState<'locked' | 'unlocking' | 'unlocked'>('locked');
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldownTime > 0) {
      cooldownIntervalRef.current = setInterval(() => {
        setCooldownTime(prev => {
          if (prev <= 1) { clearInterval(cooldownIntervalRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current); };
  }, [cooldownTime]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'PublicKeyCredential' in window) {
      setBiometricSupported(true);
    }
  }, []);

  useEffect(() => {
    if (!biometricSupported || showPasswordForm || !isFirstTime) {
      setTimeout(() => inputRef.current?.focus(), 600);
    }
  }, [biometricSupported, showPasswordForm, isFirstTime]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setSealStatus('locked');
    setTimeout(() => setShake(false), 600);
  }, []);

  const handleBiometricClick = async () => {
    if (biometricBusy || !onBiometricUnlock) return;
    setBiometricBusy(true);
    setBiometricError(null);
    setSealStatus('unlocking');
    try {
      const { credentialId: storedId } = await window.deskflowAPI.financeGetWebAuthnCredential();
      const rpId = window.location.hostname;
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      if (storedId) {
        const credential = await navigator.credentials.get({
          publicKey: { challenge, rpId, allowCredentials: [{ id: base64UrlToArrayBuffer(storedId), type: 'public-key' }], userVerification: 'required', timeout: 30000 },
        });
        if (credential) {
          const ok = await onBiometricUnlock();
          if (ok) setSealStatus('unlocked');
          else { setBiometricError('Biometric unlock failed'); setSealStatus('locked'); }
        }
      } else {
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge, rp: { id: rpId, name: 'App Tracker' },
            user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'finance', displayName: 'Finance Access' },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
            authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
            timeout: 30000,
          },
        });
        if (credential) {
          const credentialId = credential.rawId || (credential.id instanceof ArrayBuffer ? credential.id : new Uint8Array(0).buffer);
          const id = arrayBufferToBase64Url(credentialId instanceof ArrayBuffer ? credentialId : (credentialId as unknown as ArrayBuffer));
          await window.deskflowAPI.financeStoreWebAuthnCredential(id);
          const ok = await onBiometricUnlock();
          if (ok) setSealStatus('unlocked');
          else { setBiometricError('Biometric unlock failed'); setSealStatus('locked'); }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') { setSealStatus('locked'); return; }
      setBiometricError(err instanceof Error ? err.message : 'Biometric authentication failed');
      setSealStatus('locked');
    } finally { setBiometricBusy(false); }
  };

  const handleSubmit = async () => {
    if (!password || cooldownTime > 0) return;
    setSubmitting(true);
    setSealStatus('unlocking');
    try {
      if (isFirstTime) {
        if (password.length < 4) { setSetupError('Password must be at least 4 characters'); triggerShake(); setSubmitting(false); return; }
        if (password !== confirmPassword) { setSetupError('Passwords do not match'); triggerShake(); setSubmitting(false); return; }
        const ok = await onSetup(password);
        if (ok) setSealStatus('unlocked');
        else { setSetupError('Failed to set password'); triggerShake(); }
      } else {
        const ok = await onUnlock(password);
        if (ok) setSealStatus('unlocked');
        else {
          setSetupError('Incorrect password');
          if (attemptsLeft <= 1) setCooldownTime(30);
          triggerShake();
        }
      }
    } finally { setSubmitting(false); }
  };

  const displayError = error || setupError;

  /* Stagger variants */
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
  };

  const riseVariants = {
    hidden: { opacity: 0, y: 24, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div className="flex-1 flex items-center justify-center p-5 relative overflow-hidden bg-zinc-950">
      {/* Layer 1: Aurora */}
      <AuroraBackground />

      {/* Layer 2: Grid Pattern */}
      <GridPattern width={60} height={60} maxOpacity={0.06} />

      {/* Layer 3: Particles */}
      <ParticlesBackground color="#10b981" quantity={50} />

      {/* Layer 4: Ambient gradient orbs */}
      <motion.div
        className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, rgba(16,185,129,0.08), transparent 70%)' }}
        animate={{ y: [0, -30, 0], x: [0, 20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-48 -left-40 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, rgba(6,182,212,0.06), transparent 70%)' }}
        animate={{ y: [0, 40, 0], x: [0, -20, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      {/* Main Container */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md relative z-10"
      >
        {/* MagicCard wrapper with orb spotlight */}
        <motion.div variants={riseVariants}>
          <div className="relative rounded-xl p-px overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(16,185,129,0.2), rgba(6,182,212,0.1), rgba(16,185,129,0.05))',
            }}
          >
            <MagicCard
              glowFrom="#10b981"
              glowTo="#06b6d4"
              glowSize={350}
              glowBlur={50}
              glowOpacity={0.7}
              className="rounded-xl"
            >
              {/* Border beams */}
              <BorderBeam duration={7} size={300} colorFrom="#10b981" colorTo="#34d399" borderWidth={2} />
              <BorderBeam duration={9} size={300} colorFrom="#06b6d4" colorTo="#10b981" borderWidth={1} delay={3} reverse />

              {/* Card content */}
              <motion.div
                animate={shake ? { x: [0, -12, 12, -10, 10, -6, 6, -3, 3, 0] } : { x: 0 }}
                transition={{ duration: 0.5 }}
                className="relative rounded-xl p-8 flex flex-col items-center text-center"
                style={{
                  background: 'linear-gradient(180deg, rgba(24,24,27,0.85), rgba(9,9,11,0.95))',
                  backdropFilter: 'blur(40px)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {/* Inner highlight lines */}
                <div className="pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_40%)]" />
                <div className="absolute top-0 left-16 right-16 h-px bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />

                {/* Vault Seal */}
                <motion.div variants={riseVariants} className="mb-6">
                  <VaultSeal size={140} animate={!submitting} status={sealStatus} />
                </motion.div>

                {/* Title */}
                <motion.h2
                  variants={riseVariants}
                  className="text-xl font-bold text-white mb-1 tracking-tight"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {isFirstTime ? 'FINANCE VAULT' : 'VAULT LOCKED'}
                </motion.h2>

                {/* Status subtitle */}
                <motion.p variants={riseVariants} className="text-xs text-emerald-400/80 mb-6 tracking-widest uppercase font-medium">
                  {isFirstTime ? 'Initialize Security Protocol' : 'Authentication Required'}
                </motion.p>

                {/* Attempts indicator (only when not first time) */}
                {!isFirstTime && (
                  <motion.div variants={riseVariants} className="mb-5">
                    <AttemptIndicator attemptsLeft={attemptsLeft} maxAttempts={maxAttempts} />
                  </motion.div>
                )}

                {/* Form area */}
                <motion.div variants={riseVariants} className="w-full space-y-3.5">
                  {biometricSupported && !showPasswordForm && isFirstTime && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleBiometricClick}
                        disabled={biometricBusy}
                        className="relative flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden group"
                        style={{
                          background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1))',
                          border: '1px solid rgba(16,185,129,0.25)',
                          color: '#34d399',
                        }}
                      >
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_60%)] pointer-events-none" />
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.12),transparent_70%)] transition-opacity duration-300 pointer-events-none" />
                        {biometricBusy ? (
                          <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                        ) : (
                          <Fingerprint className="w-5 h-5" />
                        )}
                        <span className="relative">Set up with Windows Hello</span>
                      </motion.button>
                      <button
                        onClick={() => setShowPasswordForm(true)}
                        className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors tracking-wider uppercase"
                      >
                        Or set a password instead
                      </button>
                    </>
                  )}

                  {(!biometricSupported || showPasswordForm || !isFirstTime) && (
                    <div className="space-y-3.5">
                      <ScanLineInput
                        ref={inputRef}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(v) => { setPassword(v); setSetupError(null); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder={isFirstTime ? 'Create master password' : 'Enter password'}
                        disabled={cooldownTime > 0}
                        icon={showPassword ? EyeOff : Eye}
                      />

                      {isFirstTime && (
                        <ScanLineInput
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                          placeholder="Confirm master password"
                        />
                      )}

                      {/* Show/hide password toggle */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
                        >
                          {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {showPassword ? 'Hide password' : 'Show password'}
                        </button>
                      </div>

                      {/* Error */}
                      <AnimatePresence mode="wait">
                        {displayError && (
                          <motion.div
                            key="error"
                            initial={{ opacity: 0, y: -6, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -4, height: 0 }}
                            className="flex items-center gap-2 text-xs text-red-400 text-left overflow-hidden"
                          >
                            <div className="flex items-center gap-2 py-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {isFirstTime
                                  ? displayError
                                  : attemptsLeft > 0
                                    ? `Incorrect password — ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} left`
                                    : `Too many attempts. Try again in ${cooldownTime}s`
                                }
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Cooldown */}
                      <AnimatePresence>
                        {cooldownTime > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-xs text-red-400">
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Rate limit active</span>
                                </div>
                                <span className="text-xs text-red-400 tabular-nums font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                  {cooldownTime}s
                                </span>
                              </div>
                              <div className="w-full bg-zinc-800/60 rounded-full h-1.5 overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ background: 'linear-gradient(90deg, #ef4444, #dc2626)' }}
                                  animate={{ width: `${(cooldownTime / 30) * 100}%` }}
                                  transition={{ duration: 1, ease: 'linear' }}
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Unlock Button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: submitting ? 1 : 0.98 }}
                        onClick={handleSubmit}
                        disabled={submitting || !password || cooldownTime > 0}
                        className="relative w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950 overflow-hidden group"
                        style={{
                          background: '#059669',
                          boxShadow: '0 4px 20px rgba(16,185,129,0.15)',
                        }}
                      >
                        {submitting ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <KeyRound className="w-4 h-4" />
                            {isFirstTime ? 'Initialize Vault' : 'Unlock Vault'}
                          </>
                        )}
                      </motion.button>

                      {isFirstTime && biometricSupported && (
                        <button
                          onClick={() => setShowPasswordForm(false)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors tracking-wider uppercase"
                        >
                          Use Windows Hello instead
                        </button>
                      )}
                    </div>
                  )}

                  {/* Biometric option for returning users */}
                  {!isFirstTime && biometricSupported && (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-zinc-800/60" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-zinc-900/80 px-3 text-[10px] text-zinc-500 uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>or</span>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleBiometricClick}
                        disabled={biometricBusy}
                        className="relative flex items-center justify-center gap-2.5 w-full py-3 rounded-xl text-zinc-300 hover:text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700/30 overflow-hidden group"
                        style={{ background: 'rgba(39,39,42,0.4)' }}
                      >
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_60%)] pointer-events-none" />
                        {biometricBusy ? (
                          <div className="w-4 h-4 border-2 border-zinc-400/30 border-t-zinc-400 rounded-full animate-spin" />
                        ) : (
                          <Fingerprint className="w-4 h-4" />
                        )}
                        <span className="relative">{biometricBusy ? 'Authenticating...' : 'Use Windows Hello'}</span>
                      </motion.button>
                    </>
                  )}

                  {/* Biometric error */}
                  <AnimatePresence>
                    {biometricError && (
                      <motion.div
                        key="bio-error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 text-xs text-red-400 text-left"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{biometricError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Footer status */}
                <motion.div variants={riseVariants} className="mt-6 flex items-center gap-2 text-[10px] text-zinc-600 uppercase tracking-widest">
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>Encrypted Connection</span>
                </motion.div>
              </motion.div>
            </MagicCard>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
