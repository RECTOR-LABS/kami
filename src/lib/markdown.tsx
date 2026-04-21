import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

function isSafeHref(url: string): boolean {
  try {
    const u = new URL(url, 'http://placeholder.local');
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:';
  } catch {
    return false;
  }
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-white mt-4 mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-white mt-4 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-white mt-3 mb-1.5">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-kami-text leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc ml-5 space-y-1 text-kami-text leading-relaxed">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ml-5 space-y-1 text-kami-text leading-relaxed">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-kami-text">{children}</em>,
  del: ({ children }) => <del className="text-kami-muted">{children}</del>,
  hr: () => <hr className="border-kami-border my-3" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-kami-accent pl-3 my-2 italic text-kami-muted">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => {
    if (!href || !isSafeHref(href)) {
      return <>{children}</>;
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-kami-accent hover:text-kami-accentHover underline underline-offset-2 break-words"
      >
        {children}
      </a>
    );
  },
  code: ({ className, children }) => {
    const isBlock = typeof className === 'string' && className.startsWith('language-');
    if (isBlock) {
      return <code className={`${className} text-sm font-mono text-kami-text`}>{children}</code>;
    }
    return (
      <code className="bg-kami-border px-1.5 py-0.5 rounded text-sm font-mono text-purple-300">
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    const codeChild = React.Children.toArray(children).find(
      (c): c is React.ReactElement<{ className?: string }> =>
        React.isValidElement(c) && c.type === 'code',
    );
    const className = codeChild?.props?.className ?? '';
    const lang = className.startsWith('language-') ? className.slice('language-'.length) : '';
    return (
      <div className="my-3 rounded-lg overflow-hidden">
        {lang && (
          <div className="bg-kami-border px-3 py-1.5 text-xs text-kami-muted font-mono">
            {lang}
          </div>
        )}
        <pre className="bg-[#0d0d14] p-3 overflow-x-auto">{children}</pre>
      </div>
    );
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-kami-border">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-kami-border/60">{children}</thead>,
  tbody: ({ children }) => (
    <tbody className="divide-y divide-kami-border">{children}</tbody>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children, style }) => (
    <th
      className="px-3 py-2 text-left font-semibold text-white border-b border-kami-border"
      style={style}
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td className="px-3 py-2 text-kami-text align-top" style={style}>
      {children}
    </td>
  ),
};

export function renderMarkdown(text: string): React.ReactNode {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
}
