import { motion, useReducedMotion } from 'framer-motion';
import type { Transition } from 'framer-motion';

const PRESS_SPRING: Transition = { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 };

type SidebarLogoProps = { href?: string };

export function SidebarLogo({ href = '#/' }: SidebarLogoProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.a
      href={href}
      aria-label="RHEO — Home"
      className="sidebar-logo"
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={PRESS_SPRING}
    >
      <span className="sidebar-logo__glow" />
      <img src="/rheo-logo.png" alt="RHEO" className="sidebar-logo__img" />
      <span className="sidebar-logo__shine" />
    </motion.a>
  );
}

export default SidebarLogo;
