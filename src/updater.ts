import type { Scope } from './scope.js';

export interface Updater<TContext = unknown> {
  get currentRenderable(): Renderable<TContext> | null;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  enqueueRenderable(renderable: Renderable<TContext>): void;
  requestUpdate(): void;
}

export interface Renderable<TContext = unknown> {
  get dirty(): boolean;
  get parent(): Renderable<TContext> | null;
  bind(updater: Updater<TContext>): void;
  render(updater: Updater<TContext>, scope: Scope<TContext>): void;
}

export type CommitMode = 'mutation' | 'layout' | 'passive';

export interface Effect {
  commit(mode: CommitMode): void;
}

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
