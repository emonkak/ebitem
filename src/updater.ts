import { ChildPart } from './part/child.js';
import type { Renderable } from './renderable.js';

export interface Updater<TContext = unknown> {
  get currentRenderable(): Renderable<TContext> | null;
  enqueueLayoutEffect(effect: Effect<TContext>): void;
  enqueueMutationEffect(effect: Effect<TContext>): void;
  enqueuePassiveEffect(effect: Effect<TContext>): void;
  enqueueRenderable(renderable: Renderable<TContext>): void;
  isRunning(): boolean;
  requestUpdate(): void;
}

export interface Effect<TContext = unknown> {
  commit(updater: Updater<TContext>): void;
}

export function mount<TContext>(
  updater: Updater<TContext>,
  renderable: Renderable<TContext>,
  container: Node,
) {
  updater.enqueueRenderable(renderable);
  updater.enqueueLayoutEffect({
    commit(updater: Updater<TContext>) {
      const node = document.createComment('');
      container.appendChild(node);
      const part = new ChildPart(node);
      part.setValue(renderable, updater);
      part.commit(updater);
    },
  });
  updater.requestUpdate();
}
