import React from 'react';

interface Props {
  delay: number;
  className?: string;
  children: React.ReactNode;
  as?: 'div' | 'section' | 'article';
}

export default function BentoCell({
  delay,
  className = '',
  children,
  as: Component = 'div',
}: Props) {
  return (
    <Component
      style={{ animationDelay: `${delay * 100}ms` }}
      className={[
        'relative overflow-hidden rounded-3xl',
        'bg-kami-cellBase border border-kami-cellBorder',
        'p-6 lg:p-8',
        'transition-all duration-500 ease-smooth',
        'hover:-translate-y-[2px] hover:border-kami-amber/40',
        'hover:shadow-[0_10px_40px_-20px_rgba(255,165,0,0.15)]',
        'animate-cascade-up',
        className,
      ].join(' ')}
    >
      {children}
    </Component>
  );
}
