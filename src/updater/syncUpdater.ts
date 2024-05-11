import type { Scope } from '../scope.js';
import {
  Component,
  Effect,
  Updater,
  flushEffects,
  shouldSkipRender,
} from '../updater.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _scope: Scope<TContext>;

  private _currentComponent: Component<TContext> | null = null;

  private _pendingComponents: Component<TContext>[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _isUpdating = false;

  constructor(scope: Scope<TContext>) {
    this._scope = scope;
  }

  get currentComponent(): Component<TContext> | null {
    return this._currentComponent;
  }

  getCurrentPriority(): TaskPriority {
    return 'user-blocking';
  }

  enqueueComponent(component: Component<TContext>): void {
    this._pendingComponents.push(component);
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
        while (this._hasComponent()) {
          this._pendingComponents = [];

          for (let i = 0, l = this._pendingComponents.length; i < l; i++) {
            const component = this._pendingComponents[i]!;
            if (shouldSkipRender(component)) {
              continue;
            }
            this._currentComponent = component;
            try {
              component.render(this, this._scope);
            } finally {
              this._currentComponent = null;
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
        this._hasComponent() ||
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

  private _hasComponent(): boolean {
    return this._pendingComponents.length > 0;
  }
}
