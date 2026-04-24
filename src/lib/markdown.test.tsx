import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { renderMarkdown } from './markdown-renderer';

function r(md: string) {
  return render(<>{renderMarkdown(md)}</>);
}

describe('renderMarkdown', () => {
  it('renders a GFM table as <table>/<th>/<td>', () => {
    const { container } = r('| H1 | H2 |\n| --- | --- |\n| a | b |');
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(2);
    expect(container.textContent).not.toMatch(/\| H1 \| H2 \|/);
  });

  it('renders fenced code with the language label', () => {
    const { container } = r('```rust\nfn main() {}\n```');
    expect(container.querySelector('pre')).not.toBeNull();
    expect(container.textContent).toContain('rust');
    expect(container.textContent).toContain('fn main()');
  });

  it('renders inline code', () => {
    const { container } = r('use `foo` here');
    expect(container.querySelector('code')?.textContent).toBe('foo');
  });

  it('renders safe http(s) links with target=_blank', () => {
    const { container } = r('[link](https://kamino.finance)');
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://kamino.finance');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toContain('noopener');
  });

  it('strips javascript: links and renders only the label', () => {
    const { container } = r('[bad](javascript:alert(1))');
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('bad');
  });

  it('renders bold and italic', () => {
    const { container } = r('**bold** and *italic*');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
  });

  it('renders blockquote', () => {
    const { container } = r('> quoted');
    expect(container.querySelector('blockquote')).not.toBeNull();
  });

  it('renders unordered and ordered lists', () => {
    const { container } = r('- a\n- b\n\n1. one\n2. two');
    expect(container.querySelector('ul')).not.toBeNull();
    expect(container.querySelector('ol')).not.toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(4);
  });

  it('renders strikethrough (GFM)', () => {
    const { container } = r('~~gone~~');
    expect(container.querySelector('del')?.textContent).toBe('gone');
  });

  it('does not render raw HTML by default (XSS guard)', () => {
    const { container } = r('<img src=x onerror="alert(1)" />');
    expect(container.querySelector('img')).toBeNull();
  });
});
