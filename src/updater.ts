import type { Renderable } from './renderable.js';
import type { ScopeInterface } from './scope.js';

export interface Updater<TContext = unknown> {
  get currentRenderable(): Renderable<TContext> | null;
  get scope(): ScopeInterface<TContext>;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  enqueueRenderable(renderable: Renderable<TContext>): void;
  isRunning(): boolean;
  requestUpdate(): void;
}

export interface Effect<TContext = unknown> {
  commit(updater: Updater<TContext>): void;
}
