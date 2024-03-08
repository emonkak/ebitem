import type { Renderable } from './types.js';

export function shouldSkipRender(renderable: Renderable<unknown>): boolean {
  if (!renderable.dirty) {
    return true;
  }
  let current: Renderable<unknown> | null = renderable;
  while ((current = current.parent) !== null) {
    if (current.dirty) {
      return true;
    }
  }
  return false;
}
