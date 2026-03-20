import type { Role } from '@promptfire/shared';
import { fixtures } from '../../config';
import { exampleGalleryContent } from './content';

export type HomepageExampleId = (typeof exampleGalleryContent.examples)[number]['id'];

export const strongPromptExample = exampleGalleryContent.examples.find((example) => example.id === 'strong')!.excerpt;

export function resolveHomepageExample(id: HomepageExampleId): { prompt: string; role: Role } {
  if (id === 'general') {
    return { prompt: fixtures.general, role: 'general' };
  }

  if (id === 'marketer') {
    return { prompt: fixtures.marketer, role: 'marketer' };
  }

  if (id === 'developer') {
    return { prompt: fixtures.developer, role: 'developer' };
  }

  return { prompt: strongPromptExample, role: 'general' };
}
