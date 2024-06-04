import {
  Scheduler,
  TaskPriority,
  createDefaultScheduler,
} from './scheduler.js';
import { AtomSignal } from './signal.js';
import {
  Component,
  ContextProvider,
  Effect,
  EffectMode,
  Updater,
} from './types.js';

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
  private readonly _scope: ContextProvider<TContext>;

  private readonly _scheduler: Scheduler;

  private readonly _taskCount = new AtomSignal(0);

  private _currentComponent: Component<TContext> | null = null;

  private _currentPipeline: Pipeline<TContext> = createPipeline();

  constructor(
    scope: ContextProvider<TContext>,
    { scheduler = createDefaultScheduler() }: ConcurrentUpdaterOptions = {},
  ) {
    this._scope = scope;
    this._scheduler = scheduler;
  }

  getCurrentComponent(): Component<TContext> | null {
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
    if (this._currentComponent !== null) {
      return;
    }
    const pipeline = this._currentPipeline;
    this._scheduleRenderPipelines(pipeline);
    this._scheduleBlockingEffects(pipeline);
    this._schedulePassiveEffects(pipeline);
  }

  isNothingScheduled(): boolean {
    const pipeline = this._currentPipeline;
    return (
      this._taskCount.value === 0 &&
      pipeline.pendingComponents.length === 0 &&
      pipeline.pendingLayoutEffects.length === 0 &&
      pipeline.pendingMutationEffects.length === 0 &&
      pipeline.pendingPassiveEffects.length === 0
    );
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

  private async _beginRenderPipeline(
    rootComponent: Component<TContext>,
  ): Promise<void> {
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
          component.render(this._scope, this);
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
          try {
            await this._beginRenderPipeline(component);
          } finally {
            this._taskCount.value--;
          }
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
          try {
            flushEffects(pendingMutationEffects, 'mutation');
            flushEffects(pendingLayoutEffects, 'layout');
          } finally {
            this._taskCount.value--;
          }
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
          try {
            flushEffects(pendingPassiveEffects, 'passive');
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

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _scope: ContextProvider<TContext>;

  private _currentComponent: Component<TContext> | null = null;

  private _pendingComponents: Component<TContext>[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _isUpdating = false;

  constructor(scope: ContextProvider<TContext>) {
    this._scope = scope;
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

  isNothingScheduled(): boolean {
    return (
      this._pendingComponents.length === 0 &&
      this._pendingLayoutEffects.length === 0 &&
      this._pendingMutationEffects.length === 0 &&
      this._pendingPassiveEffects.length === 0
    );
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
            pendingComponent.render(this._scope, this);
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

        flushEffects(pendingMutationEffects, 'mutation');
        flushEffects(pendingLayoutEffects, 'layout');
      }

      if (this._pendingPassiveEffects.length > 0) {
        const pendingPassiveEffects = this._pendingPassiveEffects;

        this._pendingPassiveEffects = [];

        flushEffects(pendingPassiveEffects, 'passive');
      }
    } while (
      this._pendingComponents.length > 0 ||
      this._pendingMutationEffects.length > 0 ||
      this._pendingLayoutEffects.length > 0 ||
      this._pendingPassiveEffects.length > 0
    );
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

function flushEffects(effects: Effect[], mode: EffectMode): void {
  for (let i = 0, l = effects.length; i < l; i++) {
    effects[i]!.commit(mode);
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

function shouldSkipRender<TContext>(component: Component<TContext>): boolean {
  if (!component.dirty) {
    return true;
  }
  let parent: Component<TContext> | null = component;
  while ((parent = parent.parent) !== null) {
    if (parent.dirty) {
      return true;
    }
  }
  return false;
}
