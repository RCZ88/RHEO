// ============================================================
// DeskFlow Dashboard — BlurText
// Skill: MCP (ReactBits pattern) — blur-to-focus text entrance
// Usage: Hero titles, section headers for cinematic reveals
// ============================================================

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface BlurTextProps {
  text: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
  duration?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export function BlurText({
  text,
  className = '',
  delay = 0,
  staggerDelay = 0.04,
  duration = 0.5,
  as: Tag = 'span',
}: BlurTextProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const words = text.split(' ');

  return (
    <div ref={ref} className={className}>
      <Tag className="inline">
        {words.map((word, wordIndex) => (
          <span key={wordIndex} className="inline-block mr-[0.25em]">
            {word.split('').map((char, charIndex) => {
              const globalIndex =
                words.slice(0, wordIndex).reduce((acc, w) => acc + w.length, 0) + charIndex;
              return (
                <motion.span
                  key={charIndex}
                  initial={{ opacity: 0, filter: 'blur(8px)', y: 4 }}
                  animate={
                    isVisible
                      ? { opacity: 1, filter: 'blur(0px)', y: 0 }
                      : { opacity: 0, filter: 'blur(8px)', y: 4 }
                  }
                  transition={{
                    duration,
                    delay: delay + globalIndex * staggerDelay,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              );
            })}
          </span>
        ))}
      </Tag>
    </div>
  );
}
