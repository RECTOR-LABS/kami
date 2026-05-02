interface Props {
  videoSrc: string;
  posterSrc?: string;
}

export default function DemoVideoBand({ videoSrc, posterSrc }: Props) {
  return (
    <section
      aria-label="Kami demo video"
      className="mb-8 lg:mb-12 flex flex-col items-center gap-3"
    >
      <div className="w-full max-w-4xl aspect-[1280/1026] rounded-2xl overflow-hidden border border-kami-cellBorder bg-black shadow-2xl">
        <video
          src={videoSrc}
          poster={posterSrc}
          controls
          preload="metadata"
          playsInline
          className="w-full h-full"
        />
      </div>
      <p className="font-mono text-xs text-kami-creamMuted uppercase tracking-wider">
        [demo · 3 min walkthrough · silent]
      </p>
    </section>
  );
}
