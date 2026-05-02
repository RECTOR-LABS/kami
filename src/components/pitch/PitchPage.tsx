import { ArrowRight, ArrowUpRight, Github, PlayCircle } from 'lucide-react';

const LIVE_URL = 'https://kami.rectorspace.com';
const REPO_URL = 'https://github.com/RECTOR-LABS/kami';
const DEMO_VIDEO_URL =
  'https://aheyudueboveptjv.public.blob.vercel-storage.com/demo/kami-walkthrough.mp4';
const DEMO_POSTER_URL =
  'https://aheyudueboveptjv.public.blob.vercel-storage.com/demo/kami-walkthrough-poster.jpg';
const INTEGRATION_DOCS_URL =
  'https://github.com/RECTOR-LABS/kami/blob/main/docs/kamino-integration.md';

interface KaminoTool {
  number: number;
  name: string;
  primitive: string;
  purpose: string;
}

const KAMINO_TOOLS: KaminoTool[] = [
  { number: 1, name: 'getPortfolio', primitive: 'market.getObligationByAddress', purpose: 'Wallet positions, debt, health factor.' },
  { number: 2, name: 'findYield', primitive: 'KaminoMarket.reserves', purpose: 'Best supply / borrow APY across reserves.' },
  { number: 3, name: 'simulateHealth', primitive: 'Obligation.simulateBorrowAndWithdrawAction', purpose: 'Project post-action LTV + HF before signing.' },
  { number: 4, name: 'buildDeposit', primitive: 'KaminoAction.buildDepositTxns', purpose: 'Construct supply transaction.' },
  { number: 5, name: 'buildBorrow', primitive: 'KaminoAction.buildBorrowTxns', purpose: 'Construct borrow transaction with HF guard.' },
  { number: 6, name: 'buildRepay', primitive: 'KaminoAction.buildRepayTxns', purpose: 'Construct repay tx + auto-recover from dust floor.' },
  { number: 7, name: 'buildWithdraw', primitive: 'KaminoAction.buildWithdrawTxns', purpose: 'Construct withdraw transaction.' },
];

interface MainnetTx {
  sig: string;
  shortSig: string;
  label: string;
  hero?: boolean;
}

const MAINNET_TXS: MainnetTx[] = [
  { sig: '3kKWBmN7eV', shortSig: '3kKWBmN7eV…gGkJ1', label: 'buildRepay auto-recovery from NetValueRemainingTooSmall', hero: true },
  { sig: '4JoccMqAHq', shortSig: '4JoccMqAHq…b2SZP', label: 'buildDeposit USDC into Kamino Main Market' },
  { sig: '25YyumRhTk', shortSig: '25YyumRhTk…EtGfZ', label: 'buildDeposit follow-up' },
  { sig: '4B3nBa6GLS', shortSig: '4B3nBa6GLS…U3QSc', label: 'buildDeposit baseline' },
];

interface Sponsor {
  name: string;
  role: string;
}

const SPONSORS: Sponsor[] = [
  { name: 'Eitherway', role: 'Scaffold + deploy pipeline' },
  { name: 'Kamino', role: 'klend SDK · Main Market' },
  { name: 'Solflare', role: 'Featured wallet (Wallet Standard)' },
  { name: 'Helius', role: 'RPC proxy + preflight simulation' },
  { name: 'Vercel', role: 'Hosting · AI SDK · Blob storage' },
  { name: 'Anthropic', role: 'Claude Sonnet 4.6 (via OpenRouter)' },
];

const PRODUCTION_QUALITY: { html: React.ReactNode }[] = [
  { html: (<>Live in production at <a href={LIVE_URL} className="text-kami-amber border-b border-kami-amber/30 hover:text-kami-cream transition-colors">kami.rectorspace.com</a></>) },
  { html: '320 tests passing · 3 typecheck targets · CI green on every push' },
  { html: 'Security headers: CSP, HSTS (2y preload), X-CTO=nosniff, X-Frame=DENY, COOP, Permissions-Policy' },
  { html: 'Rate-limited via Upstash-shimmed Redis on self-hosted VPS · 30/min chat · 120/min RPC · fail-open on outage' },
  { html: '15-min uptime heartbeat workflow · GitLab auto-mirror · klend-sdk pin guard in CI' },
  { html: 'Operating cost ~$25/mo · personally funded · sustainable past the bounty window' },
  { html: 'Open source MIT' },
];

const ROADMAP: { html: React.ReactNode }[] = [
  { html: 'Phantom adapter alongside Solflare.' },
  { html: (<>Closeable obligation when <code className="font-mono text-sm text-kami-amber">klend</code> ships the upstream <code className="font-mono text-sm text-kami-amber">close_obligation</code> instruction.</>) },
  { html: 'Conversation history persistence across devices (currently localStorage-only).' },
  { html: 'Tutorial content mapping common Kamino workflows to natural-language commands.' },
  { html: 'Phantom Blowfish review submission once the lead time fits.' },
];

function SectionGrid({
  label,
  title,
  children,
  border = true,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  border?: boolean;
}) {
  return (
    <section
      className={`py-24 lg:py-32 ${border ? 'border-b border-kami-cellBorder' : ''} lg:grid lg:grid-cols-[3fr_9fr] lg:gap-16 lg:items-start`}
    >
      <div className="font-mono text-kami-amber uppercase text-xs mb-8 lg:mb-0 lg:sticky lg:top-32 tracking-widest">
        [{label}]
      </div>
      <div className="max-w-4xl w-full">
        <h2 className="font-display text-4xl lg:text-5xl leading-tight mb-8 text-kami-cream">
          {title}
        </h2>
        <div className="space-y-6">{children}</div>
      </div>
    </section>
  );
}

function ToolCard({ tool }: { tool: KaminoTool }) {
  return (
    <div className="rounded-2xl bg-black/20 border border-kami-cellBorder p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-kami-amber/40 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_40px_-15px_rgba(255,165,0,0.05)]">
      <div className="font-mono text-kami-amber font-bold mb-3 text-sm">
        {tool.number}. {tool.name}
      </div>
      <p className="text-sm text-kami-cream mb-4">{tool.purpose}</p>
      <div className="font-mono text-xs text-kami-creamMuted pt-4 border-t border-kami-cellBorder/60 truncate">
        → {tool.primitive}
      </div>
    </div>
  );
}

function TxRow({ tx, isLast }: { tx: MainnetTx; isLast: boolean }) {
  return (
    <a
      href={`https://solscan.io/tx/${tx.sig}`}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'group flex flex-col md:flex-row md:items-center gap-4 p-5 md:p-6 transition-colors relative',
        tx.hero
          ? 'bg-kami-amberHaze/30 border-b border-kami-amber/40 hover:bg-kami-amber/10'
          : 'hover:bg-white/5',
        !tx.hero && !isLast ? 'border-b border-kami-cellBorder' : '',
      ].join(' ')}
    >
      {tx.hero && <div className="absolute left-0 top-0 bottom-0 w-1 bg-kami-amber" aria-hidden="true" />}
      <span
        className={`font-mono text-sm flex-shrink-0 md:w-44 flex items-center gap-2 ${tx.hero ? 'text-kami-amber' : 'text-kami-cream'}`}
      >
        {tx.hero && <span className="text-lg" aria-hidden="true">★</span>}
        {tx.shortSig}
      </span>
      <span
        className={`text-sm flex-1 transition-colors ${tx.hero ? 'text-kami-cream' : 'text-kami-creamMuted group-hover:text-kami-cream'}`}
      >
        {tx.label}
      </span>
      <ArrowUpRight
        className={`w-4 h-4 transition-opacity ${tx.hero ? 'text-kami-amber' : 'text-kami-creamMuted'} opacity-0 group-hover:opacity-100`}
        aria-hidden="true"
      />
    </a>
  );
}

function SponsorBadge({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div>
      <div className="font-display text-xl uppercase tracking-tight mb-2 text-kami-cream">
        {sponsor.name}
      </div>
      <div className="font-mono text-xs text-kami-creamMuted">{sponsor.role}</div>
    </div>
  );
}

interface LinkCardProps {
  label: string;
  title: string;
  href: string;
  external?: boolean;
  icon: React.ReactNode;
}

function LinkCard({ label, title, href, external = true, icon }: LinkCardProps) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group block p-8 rounded-2xl bg-black/20 border border-kami-cellBorder shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-kami-amber/40 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_40px_-15px_rgba(255,165,0,0.05)]"
    >
      <div className="flex justify-between items-start mb-6">
        <span className="font-mono text-xs text-kami-creamMuted uppercase tracking-widest">
          {label}
        </span>
        <span className="text-kami-creamMuted group-hover:text-kami-amber transition-colors">
          {icon}
        </span>
      </div>
      <div className="font-display text-2xl text-kami-cream group-hover:text-white transition-colors">
        {title}
      </div>
    </a>
  );
}

export default function PitchPage() {
  return (
    <div className="min-h-screen bg-kami-sepiaBg text-kami-cream font-sans antialiased relative overflow-x-hidden">
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(245,230,211,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,230,211,0.03) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden="true"
      />
      <div
        className="fixed -top-32 -left-32 w-[40vw] h-[40vw] rounded-full bg-kami-amber blur-[150px] opacity-15 pointer-events-none -z-10 mix-blend-color-dodge"
        aria-hidden="true"
      />

      <nav className="fixed top-0 w-full z-50 bg-kami-sepiaBg/80 backdrop-blur-md border-b border-kami-cellBorder">
        <div className="max-w-[80rem] mx-auto px-6 py-4 flex justify-between items-center font-mono text-xs uppercase tracking-widest">
          <a href="/" className="text-kami-creamMuted hover:text-kami-cream transition-colors">
            ← KAMI · v1.0 · MAINNET
          </a>
          <span className="text-kami-amber">[pitch / judges]</span>
        </div>
      </nav>

      <main className="max-w-[80rem] mx-auto px-6 pb-24">
        <header className="min-h-[100dvh] flex flex-col justify-center pt-24 pb-32 border-b border-kami-cellBorder">
          <div className="max-w-5xl">
            <p className="font-mono text-kami-creamMuted text-sm uppercase tracking-widest mb-8 animate-cascade-up [animation-delay:100ms]">
              [eitherway · kamino · frontier hackathon 2026]
            </p>
            <h1 className="font-display font-medium text-6xl md:text-[6rem] leading-[0.9] tracking-tighter mb-10 text-kami-cream animate-cascade-up [animation-delay:200ms]">
              Kami — AI DeFi Co-Pilot for
              <br />
              <span className="text-kami-amber inline-block mt-2">Kamino.</span>
            </h1>
            <p className="text-xl md:text-2xl text-kami-creamMuted max-w-3xl mb-12 leading-relaxed animate-cascade-up [animation-delay:300ms]">
              Type plain English. Kami orchestrates real klend-sdk calls and returns
              ready-to-sign mainnet transactions. No dashboard scraping. No manual SDK plumbing.
            </p>
            <div className="flex flex-wrap gap-4 font-medium text-sm animate-cascade-up [animation-delay:400ms]">
              <a
                href={LIVE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-kami-amber text-kami-sepiaBg rounded-xl hover:bg-kami-cream transition-colors flex items-center gap-2 group font-bold"
              >
                Live demo
                <ArrowRight
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                  aria-hidden="true"
                />
              </a>
              <a
                href="#demo"
                className="px-8 py-4 border border-kami-cellBorder text-kami-cream hover:bg-white/5 rounded-xl transition-colors flex items-center gap-2"
              >
                Watch demo · 3 min
                <PlayCircle className="w-5 h-5 text-kami-amber" aria-hidden="true" />
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-4 border border-kami-cellBorder text-kami-creamMuted hover:text-kami-cream hover:border-kami-cream/30 rounded-xl transition-colors flex items-center gap-2"
              >
                Source · MIT
                <Github className="w-5 h-5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </header>

        <SectionGrid label="01 / problem" title="DeFi power-users carry the operational overhead.">
          <p className="text-kami-creamMuted text-lg leading-relaxed">
            Managing intricate Kamino positions requires juggling sprawling dashboards,
            cross-referencing on-chain data, and often spinning up custom scripts. Every action
            demands constant mental math to track Loan-to-Value (LTV), health factors, and
            potential slippage.
          </p>
          <p className="text-kami-creamMuted text-lg leading-relaxed">
            This cognitive load pushes new users away and slows down veterans who need to
            execute strategies quickly. The protocol is powerful, but interacting with its
            primitives remains fundamentally decoupled from human intent.
          </p>
        </SectionGrid>

        <SectionGrid label="02 / solution" title="One sentence in. One signed transaction out.">
          <p className="text-kami-creamMuted text-lg leading-relaxed">
            Kami bridges the gap. Claude Sonnet 4.6 (via OpenRouter) reasons about your
            portfolio, market conditions, and risk. It autonomously invokes specialized Kamino
            tools and emits a verified, ready-to-sign mainnet transaction directly to your
            wallet.
          </p>
          <div className="bg-black/60 border border-kami-cellBorder rounded-2xl p-8 font-mono text-sm space-y-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {[
              'deposit 5 USDC into Kamino Main Market',
              'show my positions and warn me if my health factor drops below 1.5',
              'repay everything I owe in SOL',
            ].map((prompt) => (
              <div key={prompt} className="flex gap-4">
                <span className="text-kami-amber font-bold">&gt;</span>
                <span className="text-kami-cream">{prompt}</span>
              </div>
            ))}
          </div>
        </SectionGrid>

        <section id="demo" className="py-24 lg:py-32 border-b border-kami-cellBorder">
          <div className="font-mono text-kami-amber uppercase text-xs mb-10 text-center lg:text-left tracking-widest">
            [03 / demo] — 3-minute walkthrough.
          </div>
          <div className="relative w-full aspect-[1280/1026] max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-[0_20px_50px_-15px_rgba(255,165,0,0.1)] border border-kami-cellBorder bg-black">
            <video
              src={DEMO_VIDEO_URL}
              poster={DEMO_POSTER_URL}
              controls
              preload="metadata"
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
          <p className="mt-6 text-center font-mono text-xs text-kami-creamMuted uppercase tracking-widest">
            [silent walkthrough · click to play · supports browser fullscreen]
          </p>
        </section>

        <SectionGrid label="04 / how it works" title="LLM-driven tool orchestration on mainnet.">
          <p className="text-kami-creamMuted text-lg leading-relaxed">
            User intent flows through the Vercel AI SDK to Claude Sonnet 4.6, which possesses
            contextual awareness of 7 bespoke Kamino tools. It decides the execution path,
            interacting with the raw <code className="font-mono text-kami-amber">klend-sdk</code>{' '}
            to build the instruction set. The user signs, and the Helius RPC proxy broadcasts
            the execution.
          </p>
          <div className="bg-[#120E0B] border border-kami-cellBorder rounded-2xl p-6 lg:p-12 flex items-center justify-center min-h-[300px]">
            <img
              src="/architecture.svg"
              alt="Kami architecture: user intent → LLM → 7 Kamino tools → klend-sdk → wallet sign → Helius broadcast"
              className="max-w-full opacity-90 mx-auto"
            />
          </div>
        </SectionGrid>

        <SectionGrid label="05 / integration depth" title="Seven tools, mapped 1:1 to klend-sdk.">
          <p className="text-kami-creamMuted text-lg leading-relaxed">
            Every write call is routed to{' '}
            <code className="font-mono text-kami-amber">KaminoAction.build*Txns</code> directly.
            There is no intermediary middleware and no hand-rolled instructions. The LLM
            processes structured preflight errors (like{' '}
            <code className="font-mono text-kami-amber">NetValueRemainingTooSmall</code> dust
            floors, oracle staleness, or slippage bounds) and computes recovery paths via the
            autonomous conversation context.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {KAMINO_TOOLS.map((tool) => (
              <ToolCard key={tool.name} tool={tool} />
            ))}
          </div>
          <a
            href={INTEGRATION_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex font-mono text-xs text-kami-creamMuted hover:text-kami-amber transition-colors items-center gap-2 group mt-2"
          >
            Full mapping documented in docs/kamino-integration.md
            <ArrowRight
              className="w-4 h-4 group-hover:translate-x-1 transition-transform"
              aria-hidden="true"
            />
          </a>
        </SectionGrid>

        <SectionGrid label="06 / mainnet validation" title="Confirmed Kami-broadcast transactions.">
          <p className="text-kami-creamMuted text-lg leading-relaxed">
            The defining capability. In the leading transaction,{' '}
            <code className="font-mono text-kami-amber">buildRepay</code> predictably fails due
            to an oracle-induced dust floor. The LLM catches the preflight error, explicitly
            invokes <code className="font-mono text-kami-amber">getPortfolio</code> to calculate
            the buffer margin, recalculates, and immediately returns a successful, signable
            payload — all within a single generative turn.
          </p>
          <div className="flex flex-col rounded-2xl overflow-hidden border border-kami-cellBorder bg-black/20">
            {MAINNET_TXS.map((tx, i) => (
              <TxRow key={tx.sig} tx={tx} isLast={i === MAINNET_TXS.length - 1} />
            ))}
          </div>
        </SectionGrid>

        <SectionGrid label="07 / built on" title="Sponsors stack.">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-12">
            {SPONSORS.map((sponsor) => (
              <SponsorBadge key={sponsor.name} sponsor={sponsor} />
            ))}
          </div>
        </SectionGrid>

        <SectionGrid label="08 / production quality" title="Already live. Already hardened.">
          <ul className="space-y-4 font-mono text-sm">
            {PRODUCTION_QUALITY.map((item, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="text-kami-amber mt-0.5" aria-hidden="true">✓</span>
                <span className="text-kami-creamMuted">{item.html}</span>
              </li>
            ))}
          </ul>
        </SectionGrid>

        <SectionGrid label="09 / what's next" title="Post-bounty roadmap.">
          <ul className="space-y-6 text-kami-creamMuted">
            {ROADMAP.map((item, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="font-mono text-kami-amber mt-1" aria-hidden="true">▸</span>
                <span className="text-lg leading-relaxed">{item.html}</span>
              </li>
            ))}
          </ul>
        </SectionGrid>

        <SectionGrid label="10 / links" title="Everything in one place." border={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LinkCard
              label="LIVE APP"
              title="kami.rectorspace.com"
              href={LIVE_URL}
              icon={<ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" aria-hidden="true" />}
            />
            <LinkCard
              label="SOURCE CODE"
              title="RECTOR-LABS / kami"
              href={REPO_URL}
              icon={<Github className="w-5 h-5 group-hover:scale-110 transition-transform" aria-hidden="true" />}
            />
            <LinkCard
              label="INTEGRATION DOCS"
              title="kamino-integration.md"
              href={INTEGRATION_DOCS_URL}
              icon={<ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" aria-hidden="true" />}
            />
            <LinkCard
              label="DEMO VIDEO"
              title="3-min walkthrough"
              href="#demo"
              external={false}
              icon={<PlayCircle className="w-5 h-5 group-hover:scale-110 transition-transform" aria-hidden="true" />}
            />
          </div>
        </SectionGrid>
      </main>

      <footer className="border-t border-kami-cellBorder pt-8 pb-12 px-6 relative z-10 flex flex-col items-center justify-center">
        <p className="font-mono text-xs text-kami-creamMuted text-center max-w-lg mb-4">
          Built for the Eitherway Track · Frontier Hackathon 2026 · Kamino prize
        </p>
        <a
          href="/"
          className="font-mono text-xs text-kami-amber hover:text-kami-cream transition-colors flex items-center gap-1 group"
        >
          return to live app
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
