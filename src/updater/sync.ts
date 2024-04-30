import type { AbstractScope } from '../scope.js';
import {
  CommitMode,
  Effect,
  Renderable,
  UpdatePriority,
  Updater,
  shouldSkipRender,
} from '../updater.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _scope: AbstractScope<TContext>;

  private _currentRenderble: Renderable<TContext> | null = null;

  private _pendingRenderables: Renderable<TContext>[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _isRunning = false;

  constructor(scope: AbstractScope<TContext>) {
    this._scope = scope;
  }

  get currentRenderable(): Renderable<TContext> | null {
    return this._currentRenderble;
  }

  get currentPriority(): UpdatePriority {
    return this._currentRenderble?.priority ?? UpdatePriority.Realtime;
  }

  get scope(): AbstractScope<TContext> {
    return this._scope;
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

  enqueueRenderable(renderable: Renderable<TContext>): void {
    this._pendingRenderables.push(renderable);
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  scheduleUpdate(): void {
    if (this._isRunning) {
      return;
    }
    this._isRunning = true;
    queueMicrotask(() => {
      try {
        this._runUpdateLoop();
      } finally {
        this._isRunning = false;
      }
    });
  }

  _runUpdateLoop(): void {
    console.group('Update Loop');
    do {
      if (this._hasRenderable()) {
        console.time('(1) Rendering phase');

        do {
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
        } while (this._pendingRenderables.length > 0);

        console.timeEnd('(1) Rendering phase');
      }

      if (this._hasBlockingEffect()) {
        console.time('(2) Blocking phase');

        const mutationEffects = this._pendingMutationEffects;
        const layoutEffects = this._pendingLayoutEffects;

        this._pendingMutationEffects = [];
        this._pendingLayoutEffects = [];

        for (let i = 0, l = mutationEffects.length; i < l; i++) {
          mutationEffects[i]!.commit(CommitMode.Mutation);
        }

        for (let i = 0, l = layoutEffects.length; i < l; i++) {
          layoutEffects[i]!.commit(CommitMode.Layout);
        }

        console.timeEnd('(2) Blocking phase');
      }

      if (this._hasPassiveEffect()) {
        console.time('(3) Background phase');

        const passiveEffects = this._pendingPassiveEffects;

        this._pendingPassiveEffects = [];

        for (let i = 0, l = passiveEffects.length; i < l; i++) {
          passiveEffects[i]!.commit(CommitMode.Passive);
        }

        console.timeEnd('(3) Background phase');
      }
    } while (
      this._hasRenderable() ||
      this._hasBlockingEffect() ||
      this._hasPassiveEffect()
    );
    console.groupEnd();
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
