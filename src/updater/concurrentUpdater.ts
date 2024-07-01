import { AtomSignal } from '../directives/signal.js';
import { type Scheduler, getDefaultScheduler } from '../scheduler.js';
import type {
  Block,
  Effect,
  TaskPriority,
  UpdateContext,
  Updater,
} from '../types.js';

export interface ConcurrentUpdaterOptions {
  scheduler?: Scheduler;
  taskCount?: AtomSignal<number>;
}

export class ConcurrentUpdater<TContext> implements Updater<TContext> {
  private readonly _context: UpdateContext<TContext>;

  private readonly _scheduler: Scheduler;

  private readonly _taskCount = new AtomSignal(0);

  private _currentBlock: Block<TContext> | null = null;

  private _pendingBlocks: Block<TContext>[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  constructor(
    context: UpdateContext<TContext>,
    {
      scheduler = getDefaultScheduler(),
      taskCount = new AtomSignal(0),
    }: ConcurrentUpdaterOptions = {},
  ) {
    this._context = context;
    this._scheduler = scheduler;
    this._taskCount = taskCount;
  }

  getCurrentBlock(): Block<TContext> | null {
    return this._currentBlock;
  }

  getCurrentPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return 'user-visible';
    }
  }

  enqueueBlock(block: Block<TContext>): void {
    this._pendingBlocks.push(block);
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
      this._taskCount.value > 0 ||
      this._pendingBlocks.length > 0 ||
      this._pendingLayoutEffects.length > 0 ||
      this._pendingMutationEffects.length > 0 ||
      this._pendingPassiveEffects.length > 0
    );
  }

  isScheduled(): boolean {
    return this._taskCount.value > 0;
  }

  scheduleUpdate(): void {
    if (this._currentBlock !== null) {
      return;
    }
    this._scheduleRenderPipelines();
    this._scheduleComponentingEffects();
    this._schedulePassiveEffects();
  }

  waitForUpdate(): Promise<void> {
    const taskCount = this._taskCount;
    if (taskCount.value > 0) {
      return new Promise((resolve) => {
        const subscription = taskCount.subscribe(() => {
          if (taskCount.value === 0) {
            subscription();
            resolve();
          }
        });
      });
    } else {
      return Promise.resolve();
    }
  }

  private _beginRenderPipeline(): ConcurrentUpdater<TContext> {
    return new ConcurrentUpdater(this._context, {
      scheduler: this._scheduler,
      taskCount: this._taskCount,
    });
  }

  private async _updateBlock(rootBlock: Block<TContext>): Promise<void> {
    let pendingBlocks = [rootBlock];
    let startTime = this._scheduler.getCurrentTime();

    do {
      for (let i = 0, l = pendingBlocks.length; i < l; i++) {
        const block = pendingBlocks[i]!;
        if (!block.shouldUpdate()) {
          continue;
        }

        if (
          this._scheduler.shouldYieldToMain(
            this._scheduler.getCurrentTime() - startTime,
          )
        ) {
          await this._scheduler.yieldToMain({
            priority: block.priority,
          });
          startTime = this._scheduler.getCurrentTime();
        }

        this._currentBlock = block;
        try {
          block.update(this._context, this);
        } finally {
          this._currentBlock = null;
        }
      }

      pendingBlocks = this._pendingBlocks;
      this._pendingBlocks = [];
    } while (pendingBlocks.length > 0);

    this._scheduleComponentingEffects();
    this._schedulePassiveEffects();
  }

  private _scheduleRenderPipelines(): void {
    const pendingBlocks = this._pendingBlocks;
    this._pendingBlocks = [];

    for (let i = 0, l = pendingBlocks.length; i < l; i++) {
      const block = pendingBlocks[i]!;
      this._scheduler.requestCallback(
        async () => {
          try {
            await this._beginRenderPipeline()._updateBlock(block);
          } finally {
            this._taskCount.value--;
          }
        },
        {
          priority: block.priority,
        },
      );
      this._taskCount.value++;
    }
  }

  private _scheduleComponentingEffects(): void {
    const pendingMutationEffects = this._pendingMutationEffects;
    const pendingLayoutEffects = this._pendingLayoutEffects;

    if (pendingMutationEffects.length > 0 || pendingLayoutEffects.length > 0) {
      this._pendingMutationEffects = [];
      this._pendingLayoutEffects = [];

      this._scheduler.requestCallback(
        () => {
          try {
            this._context.flushEffects(pendingMutationEffects, 'mutation');
            this._context.flushEffects(pendingLayoutEffects, 'layout');
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'user-blocking' },
      );
      this._taskCount.value++;
    }
  }

  private _schedulePassiveEffects(): void {
    const pendingPassiveEffects = this._pendingPassiveEffects;

    if (pendingPassiveEffects.length > 0) {
      this._pendingPassiveEffects = [];

      this._scheduler.requestCallback(
        () => {
          try {
            this._context.flushEffects(pendingPassiveEffects, 'passive');
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'background' },
      );
      this._taskCount.value++;
    }
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
