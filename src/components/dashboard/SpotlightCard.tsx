// ============================================================
// DeskFlow Dashboard — SpotlightCard
// Skill: MCP (ReactBits pattern) — cursor-tracking spotlight glow
// Usage: Wrap any card to add ambient depth on hover
// ============================================================

import { useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
  opacity?: number;
}

export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(139, 92, 246, 0.12)',
  opacity = 0.12,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -2, scale: 1.005 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden ${className}`}
    >
      {/* Spotlight gradient that follows cursor */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        animate={{
          opacity: isHovered ? 1 : 0,
          background: isHovered
            ? `radial-gradient(400px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 60%)`
            : 'none',
        }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
      {/* Content sits above spotlight */}
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}
