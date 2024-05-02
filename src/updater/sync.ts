import type { AbstractScope } from '../scope.js';
import { Effect, Renderable, Updater, shouldSkipRender } from '../updater.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _scope: AbstractScope<TContext>;

  private _currentRenderble: Renderable<TContext> | null = null;

  private _pendingRenderables: Renderable<TContext>[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _isUpdating = false;

  constructor(scope: AbstractScope<TContext>) {
    this._scope = scope;
  }

  get currentRenderable(): Renderable<TContext> | null {
    return this._currentRenderble;
  }

  getCurrentPriority(): TaskPriority {
    return 'user-blocking';
  }

  enqueueRenderable(renderable: Renderable<TContext>): void {
    this._pendingRenderables.push(renderable);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._pendingLayoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._pendingMutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._pendingPassiveEffects.push(effect);
  }

  isUpdating(): boolean {
    return this._isUpdating;
  }

  scheduleUpdate(): void {
    if (this._isUpdating) {
      return;
    }
    queueMicrotask(() => {
      this.flush();
    });
  }

  flush(): void {
    this._isUpdating = true;
    try {
      do {
        while (this._hasRenderable()) {
          this._pendingRenderables = [];

          for (let i = 0, l = this._pendingRenderables.length; i < l; i++) {
            const renderable = this._pendingRenderables[i]!;
            if (shouldSkipRender(renderable)) {
              continue;
            }
            this._currentRenderble = renderable;
            try {
              renderable.render(this, this._scope);
            } finally {
              this._currentRenderble = null;
            }
          }
        }

        if (this._hasBlockingEffect()) {
          const mutationEffects = this._pendingMutationEffects;
          const layoutEffects = this._pendingLayoutEffects;
          this._pendingMutationEffects = [];
          this._pendingLayoutEffects = [];

          flushEffects(mutationEffects);
          flushEffects(layoutEffects);
        }

        if (this._hasPassiveEffect()) {
          const passiveEffects = this._pendingPassiveEffects;
          this._pendingPassiveEffects = [];

          flushEffects(passiveEffects);
        }
      } while (
        this._hasRenderable() ||
        this._hasBlockingEffect() ||
        this._hasPassiveEffect()
      );
    } finally {
      this._isUpdating = false;
    }
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

function flushEffects(effects: Effect[]): void {
  for (let i = 0, l = effects.length; i < l; i++) {
    effects[i]!.commit();
  }
}
