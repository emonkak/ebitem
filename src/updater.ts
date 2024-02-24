import { ChildPart } from './parts/child.js';
import { Scheduler, getDefaultScheduler } from './scheduler.js';
import type { ScopeInterface } from './scopeInterface.js';

export interface Updater<TContext = unknown> {
  get currentRenderable(): Renderable<TContext> | null;
  enqueueLayoutEffect(effect: Effect<TContext>): void;
  enqueueMutationEffect(effect: Effect<TContext>): void;
  enqueuePassiveEffect(effect: Effect<TContext>): void;
  enqueueRenderable(renderable: Renderable<TContext>): void;
  isRunning(): boolean;
  requestUpdate(): void;
}

export interface Effect<TContext = unknown> {
  commit(updater: Updater<TContext>): void;
}

export interface Renderable<TContext> {
  get isDirty(): boolean;
  get parent(): Renderable<TContext> | null;
  forceUpdate(updater: Updater<TContext>): void;
  render(updater: Updater<TContext>, scope: ScopeInterface<TContext>): void;
}

export interface AsyncUpdaterOptions {
  scheduler?: Scheduler;
}

export class AsyncUpdater<TContext> implements Updater<TContext> {
  private readonly _scope: ScopeInterface<TContext>;

  private readonly _scheduler: Scheduler;

  private _currentRenderable: Renderable<TContext> | null = null;

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _pendingRenderables: Renderable<TContext>[] = [];

  private _runningUpdateLoop: Promise<void> | null = null;

  constructor(
    scope: ScopeInterface<TContext>,
    { scheduler = getDefaultScheduler() }: AsyncUpdaterOptions = {},
  ) {
    this._scope = scope;
    this._scheduler = scheduler;
  }

  get currentRenderable(): Renderable<TContext> | null {
    return this._currentRenderable;
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
    return this._runningUpdateLoop !== null;
  }

  async requestUpdate(): Promise<void> {
    if (this._runningUpdateLoop !== null) {
      return;
    }
    this._runningUpdateLoop = this._runUpdateLoop();
    try {
      await this._runningUpdateLoop;
    } finally {
      this._runningUpdateLoop = null;
    }
  }

  async waitForUpdate(): Promise<void> {
    if (this._runningUpdateLoop !== null) {
      await this._runningUpdateLoop;
    }
  }

  async _runUpdateLoop(): Promise<void> {
    do {
      if (this._hasRenderable()) {
        await this._scheduler.postRenderingTask(async () => {
          console.time('Rendering phase');

          let startTime = this._scheduler.getCurrentTime();

          do {
            const renderables = this._pendingRenderables;

            this._pendingRenderables = [];

            for (let i = 0, l = renderables.length; i < l; i++) {
              const renderable = renderables[i]!;
              if (shouldSkipRender(renderable)) {
                continue;
              }
              if (this._scheduler.shouldYieldToMain(startTime)) {
                await this._scheduler.yieldToMain();
                startTime = this._scheduler.getCurrentTime();
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

          let startTime = this._scheduler.getCurrentTime();

          const passiveEffects = this._pendingPassiveEffects;

          this._pendingPassiveEffects = [];

          for (let i = 0, l = passiveEffects.length; i < l; i++) {
            if (this._scheduler.shouldYieldToMain(startTime)) {
              await this._scheduler.yieldToMain();
              startTime = this._scheduler.getCurrentTime();
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

export function mount<TContext>(
  updater: Updater<TContext>,
  renderable: Renderable<TContext>,
  container: Node,
) {
  updater.enqueueRenderable(renderable);
  updater.enqueueLayoutEffect({
    commit(updater: Updater<TContext>) {
      const node = document.createComment('');
      container.appendChild(node);
      const part = new ChildPart(node);
      part.setValue(renderable, updater);
      part.commit(updater);
    },
  });
  updater.requestUpdate();
}

function shouldSkipRender(renderable: Renderable<unknown>): boolean {
  if (!renderable.isDirty) {
    return true;
  }
  let current: Renderable<unknown> | null = renderable;
  while ((current = current.parent)) {
    if (current.isDirty) {
      return true;
    }
  }
  return false;
}
