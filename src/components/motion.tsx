/**
 * Componentes de motion reutilizables.
 * Centralizamos aquí las configs de spring para consistencia.
 */
import { motion, type Variants, type MotionProps } from 'framer-motion';
import type { ReactNode, CSSProperties } from 'react';

// Spring presets
export const SPRING = {
  default: { type: 'spring' as const, stiffness: 100, damping: 20 },
  snappy:  { type: 'spring' as const, stiffness: 220, damping: 24 },
  soft:    { type: 'spring' as const, stiffness: 70,  damping: 18 },
} as const;

// Stagger orchestration
const containerVariants: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: SPRING.default,
  },
};

type StaggerProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Stagger({ children, className, style }: StaggerProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  style,
  ...rest
}: StaggerProps & Omit<MotionProps, 'variants' | 'initial' | 'animate'>) {
  return (
    <motion.div
      variants={itemVariants}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// Page enter (subtle slide + fade)
export function PageEnter({ children, className, style }: StaggerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.snappy}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// Origin-aware popover (for dropdowns)
type PopoverProps = StaggerProps & { origin?: 'top left' | 'top right' | 'top center' };

export function Popover({ children, className, style, origin = 'top left' }: PopoverProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={SPRING.snappy}
      className={className}
      style={{ transformOrigin: origin, ...style }}
    >
      {children}
    </motion.div>
  );
}
