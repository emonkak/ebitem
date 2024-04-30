import type { AbstractScope } from './scope.js';

export interface Updater<TContext = unknown> {
  get currentRenderable(): Renderable<TContext> | null;
  get currentPriority(): UpdatePriority;
  enqueueRenderable(renderable: Renderable<TContext>): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  scheduleUpdate(): void;
}

export interface Renderable<TContext = unknown> {
  get dirty(): boolean;
  get priority(): UpdatePriority;
  get parent(): Renderable<TContext> | null;
  requestUpdate(updater: Updater<TContext>, priority: UpdatePriority): void;
  render(updater: Updater<TContext>, scope: AbstractScope<TContext>): void;
}

export enum UpdatePriority {
  Idle,
  Low,
  Normal,
  High,
  Realtime,
}

export interface Effect {
  commit(mode: CommitMode): void;
}

export enum CommitMode {
  Mutation,
  Layout,
  Passive,
}

export function shouldSkipRender(renderable: Renderable<unknown>): boolean {
  if (!renderable.dirty) {
    return true;
  }
  let parent: Renderable<unknown> | null = renderable;
  while ((parent = parent.parent) !== null) {
    if (parent.dirty) {
      return true;
    }
  }
  return false;
}
