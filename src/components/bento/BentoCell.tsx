import React from 'react';

type Variant = 'full' | 'compact' | 'mini';

interface Props {
  delay: number;
  variant?: Variant;
  animate?: boolean;
  className?: string;
  children: React.ReactNode;
  as?: 'div' | 'section' | 'article';
}

const VARIANT_CLASSES: Record<Variant, string> = {
  full: 'rounded-3xl p-6 lg:p-8',
  compact: 'rounded-3xl p-4 lg:p-5',
  mini: 'rounded-2xl p-3',
};

const ANIMATION_CLASSES: Record<Variant, string> = {
  full: 'animate-cascade-up',
  compact: 'animate-cascade-up-compact',
  mini: 'animate-cascade-up-mini',
};

const VARIANT_DEFAULTS_ANIMATE: Record<Variant, boolean> = {
  full: true,
  compact: true,
  mini: false,
};

export default function BentoCell({
  delay,
  variant = 'full',
  animate,
  className = '',
  children,
  as: Component = 'div',
}: Props) {
  const shouldAnimate = animate ?? VARIANT_DEFAULTS_ANIMATE[variant];

  return (
    <Component
      style={{ animationDelay: `${delay * 100}ms` }}
      className={[
        'relative overflow-hidden',
        VARIANT_CLASSES[variant],
        'bg-kami-cellBase border border-kami-cellBorder',
        'transition-all duration-500 ease-smooth',
        'hover:-translate-y-[2px] hover:border-kami-amber/40',
        'hover:shadow-[0_10px_40px_-20px_rgba(255,165,0,0.15)]',
        shouldAnimate ? ANIMATION_CLASSES[variant] : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Component>
  );
}
