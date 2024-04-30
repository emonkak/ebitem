import { MinHeap } from '../minHeap.js';
import { Scheduler, createAdaptedScheduler } from '../scheduler.js';
import type { AbstractScope } from '../scope.js';
import {
  CommitMode,
  Effect,
  Renderable,
  UpdatePriority,
  Updater,
  shouldSkipRender,
} from '../updater.js';

interface Update<TContext> {
  id: number;
  renderable: Renderable<TContext>;
  expirationTime: number;
}

export interface AsyncUpdaterOptions {
  scheduler?: Scheduler;
}

export class AsyncUpdater<TContext> implements Updater<TContext> {
  private readonly _scope: AbstractScope<TContext>;

  private readonly _scheduler: Scheduler;

  private _currentRenderble: Renderable<TContext> | null = null;

  private _pendingUpdates: MinHeap<Update<TContext>> = new MinHeap(
    compareUpdates,
  );

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _runningUpdateLoop: Promise<void> | null = null;

  private _updateCount = 0;

  constructor(
    scope: AbstractScope<TContext>,
    { scheduler = createAdaptedScheduler() }: AsyncUpdaterOptions = {},
  ) {
    this._scope = scope;
    this._scheduler = scheduler;
  }

  get currentRenderable(): Renderable<TContext> | null {
    return this._currentRenderble;
  }

  get currentPriority(): UpdatePriority {
    return this._currentRenderble?.priority ?? getCurrentUpdatePriority();
  }

  get scope(): AbstractScope<TContext> {
    return this._scope;
  }

  enqueueRenderable(renderable: Renderable<TContext>): void {
    const expirationTime =
      this._scheduler.getCurrentTime() +
      getTimeoutFromPriority(renderable.priority);

    this._pendingUpdates.push({
      id: ++this._updateCount,
      renderable,
      expirationTime,
    });
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
          console.time('(1) Rendering Phase');

          let startTime = this._scheduler.getCurrentTime();
          let update: Update<TContext> | undefined;

          while ((update = this._pendingUpdates.peek()) !== undefined) {
            const { renderable, expirationTime } = update;
            if (shouldSkipRender(renderable)) {
              this._pendingUpdates.pop();
              continue;
            }

            const currentTime = this._scheduler.getCurrentTime();
            if (
              currentTime < expirationTime &&
              this._scheduler.shouldYieldToMain(startTime, currentTime)
            ) {
              break;
            } else {
              startTime = this._scheduler.getCurrentTime();
            }

            this._currentRenderble = renderable;
            try {
              renderable.render(this, this._scope);
            } finally {
              this._currentRenderble = null;
              this._pendingUpdates.pop();
            }
          }

          console.timeEnd('(1) Rendering Phase');
        });
      }

      if (this._hasBlockingEffect()) {
        await this._scheduler.postBlockingTask(async () => {
          console.time('(2) Blocking Phase');

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

          console.timeEnd('(2) Blocking Phase');
        });
      }

      if (this._hasPassiveEffect()) {
        await this._scheduler.postBackgroundTask(async () => {
          console.time('(3) Background Phase');

          let startTime = this._scheduler.getCurrentTime();

          const passiveEffects = this._pendingPassiveEffects;

          this._pendingPassiveEffects = [];

          for (let i = 0, l = passiveEffects.length; i < l; i++) {
            const currentTime = this._scheduler.getCurrentTime();
            if (this._scheduler.shouldYieldToMain(startTime, currentTime)) {
              await this._scheduler.yieldToMain();
              startTime = this._scheduler.getCurrentTime();
            }
            passiveEffects[i]!.commit(CommitMode.Passive);
          }

          console.timeEnd('(3) Background Phase');
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
    return this._pendingUpdates.size > 0;
  }
}

function compareUpdates<TContext>(
  first: Update<TContext>,
  second: Update<TContext>,
): number {
  return first.expirationTime !== second.expirationTime
    ? first.expirationTime - second.expirationTime
    : first.id - second.id;
}

function getCurrentUpdatePriority(): UpdatePriority {
  if (window.event !== undefined) {
    if (isContinuousEvent(window.event)) {
      return UpdatePriority.High;
    } else {
      return UpdatePriority.Realtime;
    }
  } else {
    return UpdatePriority.Normal;
  }
}

function getTimeoutFromPriority(priority: UpdatePriority): number {
  switch (priority) {
    case UpdatePriority.Idle:
      return Number.MAX_SAFE_INTEGER;
    case UpdatePriority.Low:
      return 10000;
    case UpdatePriority.Normal:
      return 5000;
    case UpdatePriority.High:
      return 250;
    case UpdatePriority.Realtime:
      return -1;
  }
}

function isContinuousEvent(event: Event): boolean {
  switch (event.type as keyof DocumentEventMap) {
    case 'drag':
    case 'dragenter':
    case 'dragleave':
    case 'dragover':
    case 'mouseenter':
    case 'mouseleave':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointerenter':
    case 'pointerleave':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'touchmove':
    case 'wheel':
      return true;
    default:
      return false;
  }
}
