import { ChildPart } from './parts/child.js';
import { Scheduler, getDefaultScheduler } from './scheduler.js';
import type { ScopeInterface } from './scopeInterface.js';

export interface Effect {
  commit(updater: Updater): void;
}

export interface Renderable<TContext> {
  get isDirty(): boolean;
  get parent(): Renderable<TContext> | null;
  forceUpdate(updater: Updater<TContext>): void;
  render(updater: Updater<TContext>, scope: ScopeInterface<TContext>): void;
}

export interface UpdaterOptions {
  scheduler: Scheduler;
}

export class Updater<TContext = unknown> {
  private readonly _scope: ScopeInterface<TContext>;

  private readonly _scheduler: Scheduler;

  private _currentRenderable: Renderable<TContext> | null = null;

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _pendingRenderables: Renderable<TContext>[] = [];

  private _isUpdating = false;

  constructor(scope: ScopeInterface<TContext>, { scheduler }: UpdaterOptions) {
    this._scope = scope;
    this._scheduler = scheduler ?? getDefaultScheduler();
  }

  get currentRenderable(): Renderable<TContext> | null {
    return this._currentRenderable;
  }

  mount(renderable: Renderable<TContext>, container: Node): void {
    this.pushRenderable(renderable);
    this.pushLayoutEffect({
      commit(updater: Updater<TContext>) {
        const node = document.createComment('');
        container.appendChild(node);
        const part = new ChildPart(node);
        part.setValue(renderable);
        part.commit(updater);
      },
    });
    this.requestUpdate();
  }

  pushLayoutEffect(effect: Effect): void {
    this._pendingLayoutEffects.push(effect);
  }

  pushMutationEffect(effect: Effect): void {
    this._pendingMutationEffects.push(effect);
  }

  pushPassiveEffect(effect: Effect): void {
    this._pendingPassiveEffects.push(effect);
  }

  pushRenderable(renderable: Renderable<TContext>): void {
    this._pendingRenderables.push(renderable);
  }

  async requestUpdate(): Promise<void> {
    if (this._isUpdating) {
      return;
    }
    this._isUpdating = true;
    try {
      await this._startLoop();
    } finally {
      this._isUpdating = false;
    }
  }

  async _startLoop(): Promise<void> {
    do {
      if (this._hasRenderable()) {
        await this._scheduler.postRenderingTask(async () => {
          console.time('Rendering phase');

          do {
            const renderables = this._pendingRenderables;

            this._pendingRenderables = [];

            for (let i = 0, l = renderables.length; i < l; i++) {
              const renderable = renderables[i]!;
              if (!renderable.isDirty || hasDirtyParent(renderable)) {
                continue;
              }
              if (navigator.scheduling.isInputPending()) {
                await yieldToMain();
              }
              this._currentRenderable = renderable;
              try {
                renderable.render(this, this._scope);
              } finally {
                this._currentRenderable = null;
              }
            }
          } while (this._pendingRenderables.length > 0);

          console.timeEnd('Rendering phase');
        });
      }

      if (this._hasBlockingEffect()) {
        await this._scheduler.postBlockingTask(async () => {
          console.time('Blocking phase');

          const mutationEffects = this._pendingMutationEffects;
          const layoutEffects = this._pendingLayoutEffects;

          this._pendingMutationEffects = [];
          this._pendingLayoutEffects = [];

          for (let i = 0, l = mutationEffects.length; i < l; i++) {
            mutationEffects[i]!.commit(this);
          }

          for (let i = 0, l = layoutEffects.length; i < l; i++) {
            layoutEffects[i]!.commit(this);
          }

          console.timeEnd('Blocking phase');
        });
      }

      if (this._hasPassiveEffect()) {
        await this._scheduler.postBackgroundTask(async () => {
          console.time('Background phase');

          const passiveEffects = this._pendingPassiveEffects;

          this._pendingPassiveEffects = [];

          for (let i = 0, l = passiveEffects.length; i < l; i++) {
            if (navigator.scheduling.isInputPending()) {
              await yieldToMain();
            }
            passiveEffects[i]!.commit(this);
          }

          console.timeEnd('Background phase');
        });
      }
    } while (
      this._hasRenderable() ||
      this._hasBlockingEffect() ||
      this._hasPassiveEffect()
    );
  }

  private _hasBlockingEffect(): boolean {
    return (
      this._pendingMutationEffects.length > 0 ||
      this._pendingLayoutEffects.length > 0
    );
  }

  private _hasPassiveEffect(): boolean {
    return this._pendingPassiveEffects.length > 0;
  }

  private _hasRenderable(): boolean {
    return this._pendingRenderables.length > 0;
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

function yieldToMain(): Promise<void> {
  if ('scheduler' in globalThis && 'yield' in scheduler) {
    return scheduler.yield();
  } else {
    return new Promise((resolve) => {
      queueMicrotask(resolve);
    });
  }
}
