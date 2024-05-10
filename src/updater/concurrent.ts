import { Scheduler, createAdaptedScheduler } from '../scheduler.js';
import type { AbstractScope } from '../scope.js';
import { AtomSignal } from '../signal.js';
import {
  Component,
  Effect,
  Updater,
  flushEffects,
  shouldSkipRender,
} from '../updater.js';

export interface ConcurrentUpdaterOptions {
  scheduler?: Scheduler;
}

interface Pipeline<TContext> {
  pendingComponents: Component<TContext>[];
  pendingLayoutEffects: Effect[];
  pendingMutationEffects: Effect[];
  pendingPassiveEffects: Effect[];
}

export class ConcurrentUpdater<TContext> implements Updater<TContext> {
  private readonly _scope: AbstractScope<TContext>;

  private readonly _scheduler: Scheduler;

  private readonly _taskCount = new AtomSignal(0);

  private _currentComponent: Component | null = null;

  private _currentPipeline: Pipeline<TContext> = createPipeline();

  constructor(
    scope: AbstractScope<TContext>,
    { scheduler = createAdaptedScheduler() }: ConcurrentUpdaterOptions = {},
  ) {
    this._scope = scope;
    this._scheduler = scheduler;
  }

  get currentComponent(): Component<TContext> | null {
    return this._currentComponent;
  }

  getCurrentPriority(): TaskPriority {
    if (window.event !== undefined) {
      return isContinuousEvent(window.event) ? 'user-visible' : 'user-blocking';
    } else {
      return 'user-visible';
    }
  }

  enqueueComponent(component: Component<TContext>): void {
    this._currentPipeline.pendingComponents.push(component);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._currentPipeline.pendingLayoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._currentPipeline.pendingMutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._currentPipeline.pendingPassiveEffects.push(effect);
  }

  scheduleUpdate(): void {
    if (this._currentComponent === null) {
      const pipeline = this._currentPipeline;
      this._scheduleRenderPipelines(pipeline);
      this._scheduleBlockingEffects(pipeline);
      this._schedulePassiveEffects(pipeline);
    }
  }

  isUpdating(): boolean {
    return this._taskCount.value > 0;
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

  private async _beginRenderPipeline(rootComponent: Component): Promise<void> {
    const pipeline = createPipeline();
    const previousPipeline = this._currentPipeline;

    let pendingComponents = [rootComponent];
    let startTime = this._scheduler.getCurrentTime();

    do {
      for (let i = 0, l = pendingComponents.length; i < l; i++) {
        const component = pendingComponents[i]!;
        if (shouldSkipRender(component)) {
          continue;
        }

        if (
          this._scheduler.shouldYieldToMain(
            this._scheduler.getCurrentTime() - startTime,
          )
        ) {
          await this._scheduler.yieldToMain({
            priority: component.priority,
          });
          startTime = this._scheduler.getCurrentTime();
        }

        this._currentComponent = component;
        this._currentPipeline = pipeline;
        try {
          component.render(this, this._scope);
        } finally {
          this._currentComponent = null;
          this._currentPipeline = previousPipeline;
        }
      }

      pendingComponents = pipeline.pendingComponents;
      pipeline.pendingComponents = [];
    } while (pendingComponents.length > 0);

    this._scheduleBlockingEffects(pipeline);
    this._schedulePassiveEffects(pipeline);
  }

  private _scheduleRenderPipelines(pipeline: Pipeline<TContext>): void {
    const { pendingComponents } = pipeline;
    pipeline.pendingComponents = [];

    for (let i = 0, l = pendingComponents.length; i < l; i++) {
      const component = pendingComponents[i]!;
      this._scheduler.requestCallback(
        async () => {
          await this._beginRenderPipeline(component);
          this._taskCount.value--;
        },
        {
          priority: component.priority,
        },
      );
      this._taskCount.value++;
    }
  }

  private _scheduleBlockingEffects(pipeline: Pipeline<TContext>): void {
    const { pendingMutationEffects, pendingLayoutEffects } = pipeline;

    if (pendingMutationEffects.length > 0 || pendingLayoutEffects.length > 0) {
      pipeline.pendingMutationEffects = [];
      pipeline.pendingLayoutEffects = [];

      this._scheduler.requestCallback(
        () => {
          flushEffects(pendingMutationEffects);
          flushEffects(pendingLayoutEffects);
          this._taskCount.value--;
        },
        { priority: 'user-blocking' },
      );
      this._taskCount.value++;
    }
  }

  private _schedulePassiveEffects(pipeline: Pipeline<TContext>): void {
    const { pendingPassiveEffects } = pipeline;

    if (pendingPassiveEffects.length > 0) {
      pipeline.pendingPassiveEffects = [];

      this._scheduler.requestCallback(
        () => {
          flushEffects(pendingPassiveEffects);
          this._taskCount.value--;
        },
        { priority: 'background' },
      );
      this._taskCount.value++;
    }
  }
}

function createPipeline<TContext>(): Pipeline<TContext> {
  return {
    pendingComponents: [],
    pendingLayoutEffects: [],
    pendingMutationEffects: [],
    pendingPassiveEffects: [],
  };
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
