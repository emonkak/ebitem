import type { AbstractScope } from './scope.js';

export interface Updater<TContext = unknown> {
  get currentRenderable(): Renderable<TContext> | null;
  getCurrentPriority(): TaskPriority;
  isUpdating(): boolean;
  enqueueRenderable(renderable: Renderable<TContext>): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  scheduleUpdate(): void;
}

export interface Renderable<TContext = unknown> {
  get dirty(): boolean;
  get parent(): Renderable<TContext> | null;
  get priority(): TaskPriority;
  requestUpdate(updater: Updater<TContext>, priority: TaskPriority): void;
  render(updater: Updater<TContext>, scope: AbstractScope<TContext>): void;
}

export interface Effect {
  commit(): void;
}

export function shouldSkipRender<TContext>(
  renderable: Renderable<TContext>,
): boolean {
  if (!renderable.dirty) {
    return true;
  }
  let parent: Renderable<TContext> | null = renderable;
  while ((parent = parent.parent) !== null) {
    if (parent.dirty) {
      return true;
    }
  }
  return false;
}
