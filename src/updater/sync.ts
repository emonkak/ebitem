import { Renderable, shouldSkipRender } from '../renderable.js';
import type { ScopeInterface } from '../scope.js';
import type { Effect, Updater } from '../updater.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _scope: ScopeInterface<TContext>;

  private _currentRenderable: Renderable<TContext> | null = null;

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _pendingRenderables: Renderable<TContext>[] = [];

  private _isRunning = false;

  constructor(scope: ScopeInterface<TContext>) {
    this._scope = scope;
  }

  get currentRenderable(): Renderable<TContext> | null {
    return this._currentRenderable;
  }

  get scope(): ScopeInterface<TContext> {
    return this._scope;
  }

  enqueueLayoutEffect(effect: Effect<TContext>): void {
    this._pendingLayoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect<TContext>): void {
    this._pendingMutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect<TContext>): void {
    this._pendingPassiveEffects.push(effect);
  }

  enqueueRenderable(renderable: Renderable<TContext>): void {
    this._pendingRenderables.push(renderable);
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  requestUpdate(): void {
    if (this._isRunning) {
      return;
    }
    this._isRunning = true;
    try {
      this._runUpdateLoop();
    } finally {
      this._isRunning = false;
    }
  }

  _runUpdateLoop(): void {
    do {
      if (this._hasRenderable()) {
        console.time('Rendering phase');

        do {
          const renderables = this._pendingRenderables;

          this._pendingRenderables = [];

          for (let i = 0, l = renderables.length; i < l; i++) {
            const renderable = renderables[i]!;
            if (shouldSkipRender(renderable)) {
              continue;
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
      }

      if (this._hasBlockingEffect()) {
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
      }

      if (this._hasPassiveEffect()) {
        console.time('Background phase');

        const passiveEffects = this._pendingPassiveEffects;

        this._pendingPassiveEffects = [];

        for (let i = 0, l = passiveEffects.length; i < l; i++) {
          passiveEffects[i]!.commit(this);
        }

        console.timeEnd('Background phase');
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
