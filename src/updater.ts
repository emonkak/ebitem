import type { TaskPriority } from './scheduler.js';
import type { Scope } from './scope.js';

export interface Updater<TContext = unknown> {
  get currentComponent(): Component<TContext> | null;
  getCurrentPriority(): TaskPriority;
  isUpdating(): boolean;
  waitForUpdate(): Promise<void>;
  enqueueComponent(component: Component<TContext>): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  scheduleUpdate(): void;
}

export interface Component<TContext = unknown> {
  get dirty(): boolean;
  get parent(): Component<TContext> | null;
  get priority(): TaskPriority;
  requestUpdate(updater: Updater<TContext>, priority: TaskPriority): void;
  render(updater: Updater<TContext>, scope: Scope<TContext>): void;
}

export interface Effect {
  commit(): void;
}

export function shouldSkipRender<TContext>(
  component: Component<TContext>,
): boolean {
  if (!component.dirty) {
    return true;
  }
  let parent: Component<TContext> | null = component;
  while ((parent = parent.parent) !== null) {
    if (parent.dirty) {
      return true;
    }
  }
  return false;
}

export function flushEffects(effects: Effect[]): void {
  for (let i = 0, l = effects.length; i < l; i++) {
    effects[i]!.commit();
  }
}
