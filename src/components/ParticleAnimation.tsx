import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: string;
  x: number;
  y: number;
  text: string;
  delay: number;
}

interface ParticleAnimationProps {
  isActive: boolean;
  targetElement?: string;
  particleCount?: number;
  spawnInterval?: number;
}

const SAMPLE_TOKENS = [
  'API', 'data', 'JSON', '42', 'research', 'query', 'source', 'fetch',
  'HTTP', 'cache', 'auth', 'user', 'id', 'token', 'key', 'value',
  'async', 'await', 'map', 'filter', 'reduce', 'sort', 'find', 'push'
];

export function ParticleAnimation({ 
  isActive, 
  targetElement = 'progress-bar',
  particleCount = 24,
  spawnInterval = 800 
}: ParticleAnimationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const spawnTimer = useRef<NodeJS.Timeout | null>(null);
  const particleCounter = useRef(0);

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!isActive || prefersReducedMotion) {
      setParticles([]);
      return;
    }

    const spawnParticle = () => {
      if (particles.length >= particleCount) return;

      const newParticle: Particle = {
        id: `particle-${particleCounter.current++}`,
        x: Math.random() * 100, // Start from random x position
        y: Math.random() * 50 + 25, // Start from middle area
        text: SAMPLE_TOKENS[Math.floor(Math.random() * SAMPLE_TOKENS.length)],
        delay: Math.random() * 0.3,
      };

      setParticles(prev => [...prev, newParticle]);

      // Remove particle after animation
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== newParticle.id));
      }, 2000);
    };

    // Start spawning particles
    spawnTimer.current = setInterval(spawnParticle, spawnInterval);

    return () => {
      if (spawnTimer.current) {
        clearInterval(spawnTimer.current);
      }
    };
  }, [isActive, particleCount, spawnInterval, particles.length, prefersReducedMotion]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (spawnTimer.current) {
        clearInterval(spawnTimer.current);
      }
    };
  }, []);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 10 }}
    >
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              x: `${particle.x}%`,
              y: `${particle.y}%`,
              opacity: 0,
              scale: 0.5,
            }}
            animate={{
              x: '50%', // Move towards center of progress bar
              y: '50%', // Move towards center of progress bar
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1, 0.8, 0],
            }}
            exit={{
              opacity: 0,
              scale: 0,
            }}
            transition={{
              duration: 1.8,
              delay: particle.delay,
              ease: 'easeInOut',
              opacity: {
                times: [0, 0.2, 0.8, 1],
                duration: 1.8,
              },
            }}
            className="absolute text-xs font-mono text-primary/60 bg-primary/10 px-2 py-1 rounded-full border border-primary/20"
            style={{
              transform: 'translate(-50%, -50%)',
            }}
          >
            {particle.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}