import type { Hook } from './hook.js';
import { ChildPart } from './parts/child.js';
import type { ScopeInterface } from './scopeInterface.js';

export interface Effect {
  commit(updater: Updater): void;
}

export interface Renderable<TContext> {
  get isDirty(): boolean;
  get parent(): Renderable<TContext> | null;
  get hooks(): Hook[];
  forceUpdate(updater: Updater<TContext>): void;
  render(scope: ScopeInterface<TContext>, updater: Updater<TContext>): void;
}

export class Updater<TContext = unknown> {
  private readonly _scope: ScopeInterface<TContext>;

  private _currentRenderable: Renderable<TContext> | null = null;

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _pendingRenderables: Renderable<TContext>[] = [];

  private _isUpdating = false;

  constructor(scope: ScopeInterface<TContext>) {
    this._scope = scope;
  }

  get currentRenderable(): Renderable<TContext> | null {
    return this._currentRenderable;
  }

  mount(container: Node, renderable: Renderable<TContext>): void {
    this.pushLayoutEffect({
      commit(updater: Updater<TContext>) {
        const node = document.createComment('');
        container.appendChild(node);
        const part = new ChildPart(node);
        part.setValue(renderable);
        part.commit(updater);
      },
    });
    this.requestUpdate(renderable);
  }

  requestUpdate(renderable: Renderable<TContext>): void {
    this._pendingRenderables.push(renderable);

    if (!this._isUpdating) {
      this._isUpdating = true;
      this._startRenderingPhase();
    }
  }

  requestMutations(): void {
    if (!this._isUpdating && this._pendingMutationEffects.length > 0) {
      this._isUpdating = true;
      this._startBlockingPhase();
    }
  }

  pushMutationEffect(effect: Effect): void {
    this._pendingMutationEffects.push(effect);
  }

  pushLayoutEffect(effect: Effect): void {
    this._pendingLayoutEffects.push(effect);
  }

  pushPassiveEffect(effect: Effect): void {
    this._pendingPassiveEffects.push(effect);
  }

  private _startRenderingPhase(): void {
    scheduleBackgroundTask(async () => {
      console.time('Rendering phase');

      for (let i = 0; i < this._pendingRenderables.length; i++) {
        if (navigator.scheduling.isInputPending()) {
          await yieldToMain();
        }
        const renderable = this._pendingRenderables[i]!;
        if (renderable.isDirty && !hasDirtyParent(renderable)) {
          this._currentRenderable = renderable;
          renderable.render(this._scope, this);
          this._currentRenderable = null;
        }
      }

      this._pendingRenderables.length = 0;

      if (
        this._pendingMutationEffects.length > 0 ||
        this._pendingLayoutEffects.length > 0
      ) {
        this._startBlockingPhase();
      } else if (this._pendingPassiveEffects.length > 0) {
        this._startPassiveEffectPhase();
      } else {
        this._isUpdating = false;
      }

      console.timeEnd('Rendering phase');
    });
  }

  private _startBlockingPhase(): void {
    scheduleUserBlockingTask(async () => {
      console.time('Blocking phase');

      for (let i = 0; i < this._pendingMutationEffects.length; i++) {
        this._pendingMutationEffects[i]!.commit(this);
      }

      this._pendingMutationEffects.length = 0;

      for (let i = 0; i < this._pendingLayoutEffects.length; i++) {
        if (navigator.scheduling.isInputPending()) {
          await yieldToMain();
        }
        this._pendingLayoutEffects[i]!.commit(this);
      }

      this._pendingLayoutEffects.length = 0;

      if (this._pendingPassiveEffects.length > 0) {
        this._startPassiveEffectPhase();
      } else if (this._pendingRenderables.length > 0) {
        this._startRenderingPhase();
      } else {
        this._isUpdating = false;
      }

      console.timeEnd('Blocking phase');
    });
  }

  private _startPassiveEffectPhase(): void {
    scheduleBackgroundTask(async () => {
      console.time('Passive effect phase');

      for (let i = 0; i < this._pendingPassiveEffects.length; i++) {
        if (navigator.scheduling.isInputPending()) {
          await yieldToMain();
        }
        this._pendingPassiveEffects[i]!.commit(this);
      }

      this._pendingPassiveEffects.length = 0;

      if (this._pendingRenderables.length > 0) {
        this._startRenderingPhase();
      } else if (
        this._pendingMutationEffects.length > 0 ||
        this._pendingLayoutEffects.length > 0
      ) {
        this._startBlockingPhase();
      } else {
        this._isUpdating = false;
      }

      console.timeEnd('Passive effect phase');
    });
  }
}

function hasDirtyParent(renderable: Renderable<unknown>): boolean {
  let currentRenderable: Renderable<unknown> | null = renderable;
  while ((currentRenderable = currentRenderable.parent)) {
    if (renderable.isDirty) {
      return true;
    }
  }
  return false;
}

function scheduleBackgroundTask(task: () => void): void {
  if ('scheduler' in globalThis && 'postTask' in scheduler) {
    scheduler.postTask(task, { priority: 'background' });
  } else {
    requestIdleCallback(task);
  }
}

function scheduleUserBlockingTask(task: () => void): void {
  if ('scheduler' in globalThis && 'postTask' in scheduler) {
    scheduler.postTask(task, { priority: 'user-blocking' });
  } else {
    requestAnimationFrame(task);
  }
}

function yieldToMain(): Promise<void> {
  if ('scheduler' in globalThis && 'yield' in scheduler) {
    return scheduler.yield();
  }

  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}
