import type {
  Component,
  Effect,
  TaskPriority,
  UpdateContext,
  Updater,
} from '../types.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _context: UpdateContext<TContext>;

  private _currentComponent: Component<TContext> | null = null;

  private _pendingComponents: Component<TContext>[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _isScheduled = false;

  constructor(context: UpdateContext<TContext>) {
    this._context = context;
  }

  getCurrentComponent(): Component<TContext> | null {
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

  isPending(): boolean {
    return (
      this._pendingComponents.length > 0 ||
      this._pendingLayoutEffects.length > 0 ||
      this._pendingMutationEffects.length > 0 ||
      this._pendingPassiveEffects.length > 0
    );
  }

  isScheduled(): boolean {
    return this._isScheduled;
  }

  scheduleUpdate(): void {
    if (this._isScheduled) {
      return;
    }

    this._isScheduled = true;

    queueMicrotask(() => {
      try {
        this.flush();
      } finally {
        this._isScheduled = false;
      }
    });
  }

  waitForUpdate(): Promise<void> {
    return this._isScheduled ? new Promise(queueMicrotask) : Promise.resolve();
  }

  flush(): void {
    do {
      while (this._pendingComponents.length > 0) {
        const pendingComponents = this._pendingComponents;
        this._pendingComponents = [];

        for (let i = 0, l = pendingComponents.length; i < l; i++) {
          const component = pendingComponents[i]!;
          if (!component.shouldUpdate()) {
            continue;
          }
          this._currentComponent = component;
          try {
            component.update(this._context, this);
          } finally {
            this._currentComponent = null;
          }
        }
      }

      if (this._pendingMutationEffects.length > 0) {
        const pendingMutationEffects = this._pendingMutationEffects;
        this._pendingMutationEffects = [];
        this._context.flushEffects(pendingMutationEffects, 'mutation');
      }

      if (this._pendingLayoutEffects.length > 0) {
        const pendingLayoutEffects = this._pendingLayoutEffects;
        this._pendingLayoutEffects = [];
        this._context.flushEffects(pendingLayoutEffects, 'layout');
      }

      if (this._pendingPassiveEffects.length > 0) {
        const pendingPassiveEffects = this._pendingPassiveEffects;
        this._pendingPassiveEffects = [];
        this._context.flushEffects(pendingPassiveEffects, 'passive');
      }
    } while (
      this._pendingComponents.length > 0 ||
      this._pendingMutationEffects.length > 0 ||
      this._pendingLayoutEffects.length > 0 ||
      this._pendingPassiveEffects.length > 0
    );
  }
}
