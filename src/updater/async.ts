import { Scheduler, createDefaultScheduler } from '../scheduler.js';
import {
  AbstractScope,
  CommitMode,
  Effect,
  Renderable,
  Updater,
} from '../types.js';
import { shouldSkipRender } from '../updater.js';

export interface AsyncUpdaterOptions {
  scheduler?: Scheduler;
}

export class AsyncUpdater<TContext> implements Updater<TContext> {
  private readonly _scope: AbstractScope<TContext>;

  private readonly _scheduler: Scheduler;

  private _currentRenderable: Renderable<TContext> | null = null;

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _pendingRenderables: Renderable<TContext>[] = [];

  private _runningUpdateLoop: Promise<void> | null = null;

  constructor(
    scope: AbstractScope<TContext>,
    { scheduler = createDefaultScheduler() }: AsyncUpdaterOptions = {},
  ) {
    this._scope = scope;
    this._scheduler = scheduler;
  }

  get currentRenderable(): Renderable<TContext> | null {
    return this._currentRenderable;
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
    return this._runningUpdateLoop !== null;
  }

  async scheduleUpdate(): Promise<void> {
    if (this._runningUpdateLoop !== null) {
      return;
    }
    this._runningUpdateLoop = this._runUpdateLoop();
    try {
      await this._scheduler.yieldToMain();
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
    console.group('Update Loop');

    do {
      if (this._hasRenderable()) {
        await this._scheduler.postRenderingTask(async () => {
          console.time('(1) Rendering phase');

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

          console.timeEnd('(1) Rendering phase');
        });
      }

      if (this._hasBlockingEffect()) {
        await this._scheduler.postBlockingTask(async () => {
          console.time('(2) Blocking phase');

          const mutationEffects = this._pendingMutationEffects;
          const layoutEffects = this._pendingLayoutEffects;

          this._pendingMutationEffects = [];
          this._pendingLayoutEffects = [];

          for (let i = 0, l = mutationEffects.length; i < l; i++) {
            mutationEffects[i]!.commit(CommitMode.MUTATION);
          }

          for (let i = 0, l = layoutEffects.length; i < l; i++) {
            layoutEffects[i]!.commit(CommitMode.LAYOUT);
          }

          console.timeEnd('(2) Blocking phase');
        });
      }

      if (this._hasPassiveEffect()) {
        await this._scheduler.postBackgroundTask(async () => {
          console.time('(3) Background phase');

          let startTime = this._scheduler.getCurrentTime();

          const passiveEffects = this._pendingPassiveEffects;

          this._pendingPassiveEffects = [];

          for (let i = 0, l = passiveEffects.length; i < l; i++) {
            if (this._scheduler.shouldYieldToMain(startTime)) {
              await this._scheduler.yieldToMain();
              startTime = this._scheduler.getCurrentTime();
            }
            passiveEffects[i]!.commit(CommitMode.PASSIVE);
          }

          console.timeEnd('(3) Background phase');
        });
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
