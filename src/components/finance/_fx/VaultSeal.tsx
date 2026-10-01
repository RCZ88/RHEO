import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

interface VaultSealProps {
  size?: number;
  animate?: boolean;
  status?: 'locked' | 'unlocking' | 'unlocked';
}

export function VaultSeal({ size = 120, animate = true, status = 'locked' }: VaultSealProps) {
  const ringConfigs = [
    { duration: 8, delay: 0, size: 1.0, opacity: 0.25, direction: 1 },
    { duration: 12, delay: 2, size: 0.75, opacity: 0.15, direction: -1 },
    { duration: 6, delay: 1, size: 0.5, opacity: 0.35, direction: 1 },
  ];

  const statusColors = {
    locked: { ring: 'rgb(16,185,129)', core: 'rgb(16,185,129)', glow: 'rgba(16,185,129,0.3)' },
    unlocking: { ring: 'rgb(251,191,36)', core: 'rgb(251,191,36)', glow: 'rgba(251,191,36,0.3)' },
    unlocked: { ring: 'rgb(52,211,153)', core: 'rgb(52,211,153)', glow: 'rgba(52,211,153,0.4)' },
  };

  const colors = statusColors[status];

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer glow */}
      <motion.div
        className="absolute rounded-full blur-xl"
        style={{
          width: size * 0.9,
          height: size * 0.9,
          background: colors.glow,
        }}
        animate={animate ? { scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Orbiting rings */}
      {ringConfigs.map((ring, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: size * ring.size,
            height: size * ring.size,
            borderColor: colors.ring,
            opacity: ring.opacity,
            borderWidth: 1.5,
          }}
          animate={animate ? { rotate: ring.direction * 360 } : {}}
          transition={{
            duration: ring.duration,
            repeat: Infinity,
            ease: 'linear',
            delay: ring.delay,
          }}
        >
          {/* Orbiting dot */}
          <div
            className="absolute rounded-full"
            style={{
              width: 6,
              height: 6,
              background: colors.ring,
              top: -3,
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: `0 0 8px ${colors.ring}`,
            }}
          />
        </motion.div>
      ))}

      {/* Inner pulse ring */}
      <motion.div
        className="absolute rounded-full border-2"
        style={{
          width: size * 0.55,
          height: size * 0.55,
          borderColor: colors.core,
          opacity: 0.4,
        }}
        animate={animate ? { scale: [1, 1.1, 1], opacity: [0.4, 0.1, 0.4] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Shield container */}
      <motion.div
        className="relative z-10 flex items-center justify-center rounded-xl"
        style={{
          width: size * 0.42,
          height: size * 0.42,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,78,59,0.3))',
          border: `1.5px solid ${colors.core}40`,
          backdropFilter: 'blur(8px)',
        }}
        animate={animate ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Shield
          className="w-1/2 h-1/2"
          style={{ color: colors.core }}
          strokeWidth={1.5}
        />
      </motion.div>
    </div>
  );
}
