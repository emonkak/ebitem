import { HIGH_PRIORITY, TaskPriority } from '../scheduler.js';
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
    return HIGH_PRIORITY;
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

    this._isUpdating = true;

    queueMicrotask(() => {
      try {
        this.flush();
      } finally {
        this._isUpdating = false;
      }
    });
  }

  waitForUpdate(): Promise<void> {
    return new Promise(queueMicrotask);
  }

  flush(): void {
    do {
      while (this._pendingComponents.length > 0) {
        const pendingComponents = this._pendingComponents;

        this._pendingComponents = [];

        for (let i = 0, l = pendingComponents.length; i < l; i++) {
          const pendingComponent = pendingComponents[i]!;
          if (shouldSkipRender(pendingComponent)) {
            continue;
          }
          this._currentComponent = pendingComponent;
          try {
            pendingComponent.render(this, this._scope);
          } finally {
            this._currentComponent = null;
          }
        }
      }

      if (
        this._pendingMutationEffects.length > 0 ||
        this._pendingLayoutEffects.length > 0
      ) {
        const pendingMutationEffects = this._pendingMutationEffects;
        const pendingLayoutEffects = this._pendingLayoutEffects;

        this._pendingMutationEffects = [];
        this._pendingLayoutEffects = [];

        flushEffects(pendingMutationEffects);
        flushEffects(pendingLayoutEffects);
      }

      if (this._pendingPassiveEffects.length > 0) {
        const pendingPassiveEffects = this._pendingPassiveEffects;

        this._pendingPassiveEffects = [];

        flushEffects(pendingPassiveEffects);
      }
    } while (
      this._pendingComponents.length > 0 ||
      this._pendingMutationEffects.length > 0 ||
      this._pendingLayoutEffects.length > 0 ||
      this._pendingPassiveEffects.length > 0
    );
  }
}
