export interface MotionPreset {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'advanced';
  category: 'text' | 'card' | 'button' | 'list' | 'special';
  defaultDuration: number;
  defaultEase: string;
  codeTemplate: (opts: { duration: number; ease: string; delay?: number; stagger?: number }) => string;
}

export const SWISHY_PRESETS: MotionPreset[] = [
  {
    id: 'word-fade-cascade',
    name: 'Word Fade Cascade',
    description: 'Each word fades in with a staggered delay creating a cascading reveal effect',
    difficulty: 'easy',
    category: 'text',
    defaultDuration: 0.5,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease, delay = 0, stagger = 0.1 }) =>
      `motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: ${duration}, ease: "${ease}", delay: ${delay}, staggerChildren: ${stagger} }}
  // Wrap each word in motion.span with variants`,
  },
  {
    id: 'character-reveal',
    name: 'Character Reveal',
    description: 'Individual characters animate in with rotation and opacity',
    difficulty: 'medium',
    category: 'text',
    defaultDuration: 0.4,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease, delay = 0, stagger = 0.03 }) =>
      `const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: ${stagger}, delayChildren: ${delay} } } };
const child = { hidden: { opacity: 0, rotateX: -90 }, visible: { opacity: 1, rotateX: 0, transition: { duration: ${duration}, ease: "${ease}" } } };
// Apply variants to motion.div and motion.span`,
  },
  {
    id: 'glow-pulse',
    name: 'Glow Pulse',
    description: 'Text emits a rhythmic glowing shadow pulse',
    difficulty: 'easy',
    category: 'text',
    defaultDuration: 2,
    defaultEase: 'easeInOut',
    codeTemplate: ({ duration, ease }) =>
      `motion.div
  animate={{ textShadow: [
    "0 0 10px rgba(244,114,182,0)",
    "0 0 20px rgba(244,114,182,0.5)",
    "0 0 10px rgba(244,114,182,0)"
  ] }}
  transition={{ duration: ${duration}, ease: "${ease}", repeat: Infinity }}`,
  },
  {
    id: 'card-hover-lift',
    name: 'Card Hover Lift',
    description: 'Card elevates with shadow expansion on hover',
    difficulty: 'easy',
    category: 'card',
    defaultDuration: 0.3,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease }) =>
      `motion.div
  whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
  transition={{ duration: ${duration}, ease: "${ease}" }}
  className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-800/60 rounded-xl p-5"`,
  },
  {
    id: 'magnetic-button',
    name: 'Magnetic Button',
    description: 'Button follows cursor with spring physics when nearby',
    difficulty: 'advanced',
    category: 'button',
    defaultDuration: 0.15,
    defaultEase: 'spring',
    codeTemplate: ({ duration }) =>
      `// Use useMotionValue + useSpring
const x = useMotionValue(0);
const y = useMotionValue(0);
const springX = useSpring(x, { stiffness: 150, damping: 15 });
const springY = useSpring(y, { stiffness: 150, damping: 15 });
// On mouse move, calculate offset from center and set x/y`,
  },
  {
    id: 'stagger-list',
    name: 'Stagger List',
    description: 'List items cascade in with configurable stagger',
    difficulty: 'easy',
    category: 'list',
    defaultDuration: 0.4,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease, delay = 0, stagger = 0.1 }) =>
      `const variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: ${duration}, ease: "${ease}", staggerChildren: ${stagger}, delayChildren: ${delay} } }
};
// Parent: motion.ul with variants
// Children: motion.li with variants`,
  },
  {
    id: 'scale-in',
    name: 'Scale In',
    description: 'Element scales from 0 to 1 with opacity fade',
    difficulty: 'easy',
    category: 'special',
    defaultDuration: 0.5,
    defaultEase: 'backOut',
    codeTemplate: ({ duration, ease, delay = 0 }) =>
      `motion.div
  initial={{ opacity: 0, scale: 0 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: ${duration}, ease: "${ease}", delay: ${delay} }}`,
  },
  {
    id: 'rotate-in',
    name: 'Rotate In',
    description: 'Element rotates from -180deg while fading in',
    difficulty: 'medium',
    category: 'special',
    defaultDuration: 0.6,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease, delay = 0 }) =>
      `motion.div
  initial={{ opacity: 0, rotate: -180 }}
  animate={{ opacity: 1, rotate: 0 }}
  transition={{ duration: ${duration}, ease: "${ease}", delay: ${delay} }}`,
  },
  {
    id: 'stretch-in',
    name: 'Stretch In',
    description: 'Horizontal stretch squash effect on entrance',
    difficulty: 'medium',
    category: 'text',
    defaultDuration: 0.5,
    defaultEase: 'easeOut',
    codeTemplate: ({ duration, ease, delay = 0 }) =>
      `motion.div
  initial={{ opacity: 0, scaleX: 0.3 }}
  animate={{ opacity: 1, scaleX: 1 }}
  transition={{ duration: ${duration}, ease: "${ease}", delay: ${delay} }}`,
  },
  {
    id: 'bounce-in',
    name: 'Bounce In',
    description: 'Heavy bounce overshoot on entrance',
    difficulty: 'easy',
    category: 'special',
    defaultDuration: 0.6,
    defaultEase: 'spring',
    codeTemplate: ({ duration }) =>
      `motion.div
  initial={{ opacity: 0, y: 50 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 20, duration: ${duration} }}`,
  },
  {
    id: 'shimmer-text',
    name: 'Shimmer Text',
    description: 'Diagonal light sweep across text surface',
    difficulty: 'advanced',
    category: 'text',
    defaultDuration: 2,
    defaultEase: 'linear',
    codeTemplate: ({ duration }) =>
      `// CSS background-clip text with animated gradient
background: linear-gradient(90deg, #e4e4e7 0%, #f472b6 50%, #e4e4e7 100%);
background-size: 200% auto;
animation: shimmer ${duration}s linear infinite;
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;`,
  },
  {
    id: 'morphing-gradient',
    name: 'Morphing Gradient',
    description: 'Background gradient shifts hue continuously',
    difficulty: 'medium',
    category: 'special',
    defaultDuration: 8,
    defaultEase: 'linear',
    codeTemplate: ({ duration }) =>
      `motion.div
  animate={{
    background: [
      "linear-gradient(135deg, #18181b, #27272a)",
      "linear-gradient(135deg, #27272a, #3f3f46)",
      "linear-gradient(135deg, #18181b, #27272a)"
    ]
  }}
  transition={{ duration: ${duration}, ease: "linear", repeat: Infinity }}`,
  },
];

export const EASING_PRESETS = [
  { name: 'Linear', value: [0, 0, 1, 1], type: 'bezier' },
  { name: 'Ease', value: [0.25, 0.1, 0.25, 1], type: 'bezier' },
  { name: 'Ease In', value: [0.42, 0, 1, 1], type: 'bezier' },
  { name: 'Ease Out', value: [0, 0, 0.58, 1], type: 'bezier' },
  { name: 'Ease In Out', value: [0.42, 0, 0.58, 1], type: 'bezier' },
  { name: 'Spring Gentle', value: { stiffness: 120, damping: 14, mass: 1 }, type: 'spring' },
  { name: 'Spring Bouncy', value: { stiffness: 300, damping: 10, mass: 1 }, type: 'spring' },
  { name: 'Anticipate', value: [0.36, 0, 0.66, -0.56], type: 'bezier' },
  { name: 'Overshoot', value: [0.34, 1.56, 0.64, 1], type: 'bezier' },
];

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    case 'medium': return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
    case 'advanced': return 'bg-rose-500/15 text-rose-400 border-rose-500/20';
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
  }
}

export function getCategoryIcon(category: string): string {
  switch (category) {
    case 'text': return 'Type';
    case 'card': return 'LayoutGrid';
    case 'button': return 'MousePointerClick';
    case 'list': return 'List';
    case 'special': return 'Sparkles';
    default: return 'Box';
  }
}
