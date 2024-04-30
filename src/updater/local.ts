import type { AbstractScope } from '../scope.js';
import {
  CommitMode,
  Effect,
  Renderable,
  UpdatePriority,
  Updater,
  shouldSkipRender,
} from '../updater.js';

export class LocalUpdater<TContext> implements Updater<TContext>, Effect {
  private _currentRenderble: Renderable<TContext> | null;

  private _pendingRenderables: Renderable<TContext>[] = [];

  private _mutationEffects: Effect[] = [];

  private _layoutEffects: Effect[] = [];

  private _passiveEffects: Effect[] = [];

  private _shouldUpdate = false;

  constructor(currentRenderble: Renderable<TContext> | null = null) {
    this._currentRenderble = currentRenderble;
  }

  get currentRenderable(): Renderable<TContext> | null {
    return this._currentRenderble;
  }

  get currentPriority(): UpdatePriority {
    return this._currentRenderble?.priority ?? UpdatePriority.Realtime;
  }

  get mutationEffects(): Effect[] {
    return this._mutationEffects;
  }

  get layoutEffects(): Effect[] {
    return this._layoutEffects;
  }

  get passiveEffects(): Effect[] {
    return this._passiveEffects;
  }

  commit(mode: CommitMode): void {
    switch (mode) {
      case CommitMode.Mutation:
        const mutationEffects = this._mutationEffects;
        this._mutationEffects = [];
        for (let i = 0, l = mutationEffects.length; i < l; i++) {
          mutationEffects[i]!.commit(mode);
        }
        break;
      case CommitMode.Layout:
        const layoutEffects = this._layoutEffects;
        this._layoutEffects = [];
        for (let i = 0, l = layoutEffects.length; i < l; i++) {
          layoutEffects[i]!.commit(mode);
        }
        break;
      case CommitMode.Passive:
        const passiveEffects = this._passiveEffects;
        this._passiveEffects = [];
        for (let i = 0, l = passiveEffects.length; i < l; i++) {
          passiveEffects[i]!.commit(mode);
        }
        break;
    }
  }

  enqueueRenderable(renderable: Renderable<TContext>): void {
    this._pendingRenderables.push(renderable);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._layoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._mutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._passiveEffects.push(effect);
  }

  flush(scope: AbstractScope<TContext>): void {
    const originalCurrentUpdate = this._currentRenderble;

    this._pendingRenderables = [];

    for (let i = 0, l = this._pendingRenderables.length; i < l; i++) {
      const renderable = this._pendingRenderables[i]!;
      if (shouldSkipRender(renderable)) {
        continue;
      }
      this._currentRenderble = renderable;
      try {
        renderable.render(this, scope);
      } finally {
        this._currentRenderble = originalCurrentUpdate;
      }
    }

    this.commit(CommitMode.Mutation);
    this.commit(CommitMode.Layout);
    this.commit(CommitMode.Passive);
  }

  pipe(updater: Updater): void {
    for (let i = 0, l = this._pendingRenderables.length; i < l; i++) {
      const renderable = this._pendingRenderables[i]!;
      updater.enqueueRenderable(renderable);
    }

    if (this._mutationEffects.length > 0) {
      updater.enqueueMutationEffect(this);
    }

    if (this._layoutEffects.length > 0) {
      updater.enqueueLayoutEffect(this);
    }

    if (this._passiveEffects.length > 0) {
      updater.enqueueLayoutEffect(this);
    }

    if (this._shouldUpdate) {
      updater.scheduleUpdate();
    }

    this._pendingRenderables = [];
    this._shouldUpdate = false;
  }

  scheduleUpdate(): void {
    this._shouldUpdate = true;
  }
}
