import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { exampleGalleryContent } from './content';
import { ExampleGallerySection } from './ExampleGallerySection';

describe('ExampleGallerySection', () => {
  it('renders all example cards and their actions', () => {
    const markup = renderToStaticMarkup(
      <ExampleGallerySection content={exampleGalleryContent} onLoadExample={vi.fn()} loading={false} />,
    );

    expect(markup).toContain('Broad general prompt');
    expect(markup).toContain('IAM landing page');
    expect(markup).toContain('TypeScript trade-offs');
    expect(markup).toContain('Strong prompt example');
    expect(markup.match(/Load example/g)?.length).toBe(4);
  });
});
