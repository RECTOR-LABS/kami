import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PitchPage from './PitchPage';

describe('PitchPage', () => {
  it('renders the hero headline with Kamino accent', () => {
    render(<PitchPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Kami — AI DeFi Co-Pilot for/i,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Kamino\./i);
  });

  it('renders the eitherway/kamino/frontier kicker', () => {
    render(<PitchPage />);
    expect(screen.getByText(/eitherway · kamino · frontier hackathon 2026/i)).toBeInTheDocument();
  });

  it('renders all 10 numbered section labels', () => {
    render(<PitchPage />);
    for (let i = 1; i <= 10; i++) {
      const padded = String(i).padStart(2, '0');
      expect(screen.getByText(new RegExp(`\\[${padded} /`, 'i'))).toBeInTheDocument();
    }
  });

  it('renders the demo video element with correct src + poster + controls', () => {
    const { container } = render(<PitchPage />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toContain('kami-walkthrough.mp4');
    expect(video?.getAttribute('poster')).toContain('kami-walkthrough-poster.jpg');
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.getAttribute('preload')).toBe('metadata');
  });

  it('renders all 7 Kamino tools by name', () => {
    render(<PitchPage />);
    const tools = [
      'getPortfolio',
      'findYield',
      'simulateHealth',
      'buildDeposit',
      'buildBorrow',
      'buildRepay',
      'buildWithdraw',
    ];
    tools.forEach((tool) => {
      expect(screen.getByText(new RegExp(`\\d+\\. ${tool}`))).toBeInTheDocument();
    });
  });

  it('renders all 4 mainnet tx signatures with Solscan links', () => {
    render(<PitchPage />);
    const sigs = [
      ['3kKWBmN7eV', '3kKWBmN7eV…gGkJ1'],
      ['4JoccMqAHq', '4JoccMqAHq…b2SZP'],
      ['25YyumRhTk', '25YyumRhTk…EtGfZ'],
      ['4B3nBa6GLS', '4B3nBa6GLS…U3QSc'],
    ];
    sigs.forEach(([sig, label]) => {
      const link = screen.getByText(label).closest('a');
      expect(link?.getAttribute('href')).toBe(`https://solscan.io/tx/${sig}`);
    });
  });

  it('marks the hero (first) tx with star prefix', () => {
    render(<PitchPage />);
    const heroLink = screen.getByText('3kKWBmN7eV…gGkJ1').closest('a');
    expect(heroLink?.textContent).toContain('★');
  });

  it('renders all 6 sponsor names', () => {
    render(<PitchPage />);
    const sponsors = ['Eitherway', 'Kamino', 'Solflare', 'Helius', 'Vercel', 'Anthropic'];
    sponsors.forEach((sponsor) => {
      expect(screen.getByText(sponsor)).toBeInTheDocument();
    });
  });

  it('renders the architecture SVG via /architecture.svg', () => {
    const { container } = render(<PitchPage />);
    const img = container.querySelector('img[alt*="architecture"]');
    expect(img?.getAttribute('src')).toBe('/architecture.svg');
  });

  it('renders the integration docs link in section 05 + section 10', () => {
    render(<PitchPage />);
    const links = screen.getAllByRole('link', { name: /kamino-integration\.md/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    links.forEach((link) => {
      expect(link.getAttribute('href')).toBe(
        'https://github.com/RECTOR-LABS/kami/blob/main/docs/kamino-integration.md',
      );
    });
  });

  it('renders the GitHub source link', () => {
    render(<PitchPage />);
    const githubLinks = screen.getAllByRole('link', { name: /source.*MIT|RECTOR-LABS \/ kami/i });
    expect(githubLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the live URL primary CTA', () => {
    render(<PitchPage />);
    const liveCta = screen.getByRole('link', { name: /live demo/i });
    expect(liveCta.getAttribute('href')).toBe('https://kami.rectorspace.com');
  });

  it('renders the footer with bounty context', () => {
    render(<PitchPage />);
    expect(
      screen.getByText(/Eitherway Track · Frontier Hackathon 2026 · Kamino prize/i),
    ).toBeInTheDocument();
  });
});
