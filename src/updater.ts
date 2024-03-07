import type { Part } from './part.js';
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
  get part(): Part;
  get parent(): Renderable<TContext> | null;
  forceUpdate(updater: Updater<TContext>): void;
  render(updater: Updater<TContext>, scope: Scope<TContext>): void;
}

export type CommitMode = 'mutation' | 'layout' | 'passive';

export interface Effect {
  commit(mode: CommitMode, updater: Updater): void;
}

export interface Disconnectable {
  disconnect(): void;
}

export class Disconnect implements Effect {
  private readonly _disconnectable: Disconnectable;

  constructor(disconnectable: Disconnectable) {
    this._disconnectable = disconnectable;
  }

  commit() {
    this._disconnectable.disconnect();
  }
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

export function boot<TContext>(
  renderable: Renderable<TContext>,
  container: Node,
  updater: Updater<TContext>,
) {
  updater.enqueueMutationEffect({
    commit() {
      container.appendChild(renderable.part.node);
    },
  });
  renderable.forceUpdate(updater);
}
