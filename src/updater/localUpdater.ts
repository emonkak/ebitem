import { CommitMode, Effect, Renderable, Updater } from '../types.js';

export class LocalUpdater<TContext> implements Updater<TContext>, Effect {
  private readonly _currentRenderable: Renderable<TContext> | null;

  private _renderables: Renderable<TContext>[] = [];

  private _mutationEffects: Effect[] = [];

  private _layoutEffects: Effect[] = [];

  private _passiveEffects: Effect[] = [];

  private _shouldUpdate = false;

  constructor(currentRenderable: Renderable<TContext> | null = null) {
    this._currentRenderable = currentRenderable;
  }

  get currentRenderable(): Renderable<TContext> | null {
    return this._currentRenderable;
  }

  get renderables(): Renderable<TContext>[] {
    return this._renderables;
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
      case CommitMode.MUTATION:
        const mutationEffects = this._mutationEffects;
        this._mutationEffects = [];
        for (let i = 0, l = mutationEffects.length; i < l; i++) {
          mutationEffects[i]!.commit(mode);
        }
        break;
      case CommitMode.LAYOUT:
        const layoutEffects = this._layoutEffects;
        this._layoutEffects = [];
        for (let i = 0, l = layoutEffects.length; i < l; i++) {
          layoutEffects[i]!.commit(mode);
        }
        break;
      case CommitMode.PASSIVE:
        const passiveEffects = this._passiveEffects;
        this._passiveEffects = [];
        for (let i = 0, l = passiveEffects.length; i < l; i++) {
          passiveEffects[i]!.commit(mode);
        }
        break;
    }
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

  enqueueRenderable(renderable: Renderable): void {
    this._renderables.push(renderable);
  }

  flush(): void {
    this.commit(CommitMode.MUTATION);
    this.commit(CommitMode.LAYOUT);
    this.commit(CommitMode.PASSIVE);
  }

  pipeTo(updater: Updater): void {
    for (let i = 0, l = this._renderables.length; i < l; i++) {
      updater.enqueueRenderable(this._renderables[i]!);
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

    this._renderables = [];
    this._shouldUpdate = false;
  }

  scheduleUpdate(): void {
    this._shouldUpdate = true;
  }
}
