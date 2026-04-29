import { Cpu } from 'lucide-react';
import BentoCell from '../bento/BentoCell';
import { LANDING_STATS } from '../../lib/landing-content';

interface Props {
  delay: number;
}

export default function SysMetricsCell({ delay }: Props) {
  return (
    <BentoCell delay={delay} className="col-span-12 md:col-span-6 lg:col-span-4">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-kami-creamMuted mb-6">
        <Cpu className="w-4 h-4" aria-hidden="true" />
        sys.metrics
      </div>
      <ul className="flex flex-col">
        {LANDING_STATS.map((stat, i) => (
          <li
            key={stat.key}
            className={[
              'flex justify-between items-baseline py-3 font-mono text-sm group',
              i < LANDING_STATS.length - 1 ? 'border-b border-kami-cellBorder/50' : '',
            ].join(' ')}
          >
            <span className="text-kami-creamMuted">{stat.key}</span>
            <span
              className={[
                'transition-transform duration-200 ease-smooth group-hover:translate-x-[1px]',
                stat.highlight ? 'text-kami-amber font-bold' : 'text-kami-cream',
              ].join(' ')}
            >
              {stat.value}
            </span>
          </li>
        ))}
      </ul>
    </BentoCell>
  );
}
