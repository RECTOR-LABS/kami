import React, { Suspense, lazy } from 'react';

const MarkdownRenderer = lazy(() => import('./markdown-renderer'));

export function Markdown({ text }: { text: string }) {
  return (
    <Suspense fallback={<p className="text-kami-cream leading-relaxed whitespace-pre-wrap">{text}</p>}>
      <MarkdownRenderer text={text} />
    </Suspense>
  );
}

export function renderMarkdown(text: string): React.ReactNode {
  return <Markdown text={text} />;
}
