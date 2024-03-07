import { CommitMode, Effect, Renderable, Updater } from '../updater.js';

export class LocalUpdater<TContext> implements Updater<TContext>, Effect {
  private readonly _currentRenderable: Renderable<TContext> | null;

  private _renderables: Renderable<TContext>[] = [];

  private _mutationEffects: Effect[] = [];

  private _layoutEffects: Effect[] = [];

  private _passiveEffects: Effect[] = [];

  private _shouldUpdate = false;

  constructor(currentRenderable: Renderable<TContext> | null) {
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

  requestUpdate(): void {
    this._shouldUpdate = true;
  }

  commit(mode: CommitMode): void {
    switch (mode) {
      case 'mutation':
        for (let i = 0, l = this._mutationEffects.length; i < l; i++) {
          this._mutationEffects[i]!.commit(mode, this);
        }
        this._mutationEffects = [];
        break;
      case 'layout':
        for (let i = 0, l = this._layoutEffects.length; i < l; i++) {
          this._layoutEffects[i]!.commit(mode, this);
        }
        this._layoutEffects = [];
        break;
      case 'passive':
        for (let i = 0, l = this._passiveEffects.length; i < l; i++) {
          this._passiveEffects[i]!.commit(mode, this);
        }
        this._passiveEffects = [];
        break;
    }
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
      updater.requestUpdate();
    }

    this._renderables = [];
    this._shouldUpdate = false;
  }
}
