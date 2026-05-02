import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DemoVideoBand from './DemoVideoBand';

const TEST_URL = 'https://example.com/test-video.mp4';

describe('DemoVideoBand', () => {
  it('renders a section labeled for assistive tech', () => {
    render(<DemoVideoBand videoSrc={TEST_URL} />);
    expect(screen.getByRole('region', { name: /kami demo video/i })).toBeInTheDocument();
  });

  it('renders the caption noting the demo is silent', () => {
    render(<DemoVideoBand videoSrc={TEST_URL} />);
    expect(screen.getByText(/3 min walkthrough/i)).toBeInTheDocument();
    expect(screen.getByText(/silent/i)).toBeInTheDocument();
  });

  it('renders a video element with the provided source', () => {
    const { container } = render(<DemoVideoBand videoSrc={TEST_URL} />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe(TEST_URL);
  });

  it('renders native HTML5 controls on the video', () => {
    const { container } = render(<DemoVideoBand videoSrc={TEST_URL} />);
    const video = container.querySelector('video');
    expect(video?.hasAttribute('controls')).toBe(true);
  });

  it('uses preload="metadata" so the full file is not downloaded eagerly', () => {
    const { container } = render(<DemoVideoBand videoSrc={TEST_URL} />);
    const video = container.querySelector('video');
    expect(video?.getAttribute('preload')).toBe('metadata');
  });

  it('sets playsInline so iOS plays inline instead of fullscreen-takeover', () => {
    const { container } = render(<DemoVideoBand videoSrc={TEST_URL} />);
    const video = container.querySelector('video');
    expect(video?.hasAttribute('playsinline')).toBe(true);
  });

  it('renders the poster attribute when posterSrc is provided', () => {
    const POSTER = 'https://example.com/poster.jpg';
    const { container } = render(<DemoVideoBand videoSrc={TEST_URL} posterSrc={POSTER} />);
    const video = container.querySelector('video');
    expect(video?.getAttribute('poster')).toBe(POSTER);
  });

  it('omits the poster attribute when posterSrc is not provided', () => {
    const { container } = render(<DemoVideoBand videoSrc={TEST_URL} />);
    const video = container.querySelector('video');
    expect(video?.hasAttribute('poster')).toBe(false);
  });

  it('preserves the recording aspect ratio via the wrapper container', () => {
    const { container } = render(<DemoVideoBand videoSrc={TEST_URL} />);
    const wrapper = container.querySelector('section > div');
    expect(wrapper?.className).toMatch(/aspect-\[1280\/1026\]/);
  });
});
