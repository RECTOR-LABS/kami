import { Fragment } from 'react';
import { SPONSORS } from '../../lib/landing-content';

export default function SponsorStrip() {
  return (
    <div
      className="col-span-12 py-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500 ease-smooth"
      aria-label="Sponsors"
    >
      {SPONSORS.map((name, i) => (
        <Fragment key={name}>
          <span className="font-display font-bold uppercase tracking-widest text-sm text-kami-cream">
            {name}
          </span>
          {i < SPONSORS.length - 1 ? (
            <span aria-hidden="true" className="text-kami-amber/40">
              ·
            </span>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
