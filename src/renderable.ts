import { ChildPart } from './part/child.js';
import type { ScopeInterface } from './scope.js';
import type { Updater } from './updater.js';

export interface Renderable<TContext> {
  get isDirty(): boolean;
  get parent(): Renderable<TContext> | null;
  forceUpdate(updater: Updater<TContext>): void;
  render(updater: Updater<TContext>, scope: ScopeInterface<TContext>): void;
}

export function shouldSkipRender(renderable: Renderable<unknown>): boolean {
  if (!renderable.isDirty) {
    return true;
  }
  let current: Renderable<unknown> | null = renderable;
  while ((current = current.parent) !== null) {
    if (current.isDirty) {
      return true;
    }
  }
  return false;
}

export function mount<TContext>(
  renderable: Renderable<TContext>,
  container: Node,
  updater: Updater<TContext>,
) {
  updater.enqueueRenderable(renderable);
  updater.enqueueLayoutEffect({
    commit(updater: Updater<TContext>) {
      const node = document.createComment('');
      container.appendChild(node);
      const part = new ChildPart(node);
      part.value = renderable;
      part.commit(updater);
    },
  });
  updater.requestUpdate();
}
