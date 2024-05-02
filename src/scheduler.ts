export interface Scheduler {
  getCurrentTime(): number;
  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: Pick<SchedulerPostTaskOptions, 'priority'>,
  ): Promise<T>;
  shouldYieldToMain(elapsedTime: number): boolean;
  yieldToMain(options?: Pick<SchedulerYieldOptions, 'priority'>): Promise<void>;
}

const FRAME_YIELD_INTERVAL = 5;
const CONTINUOUS_INPUT_INTERVAL = 50;
const MAX_YIELD_INTERVAL = 300;

export function createAdaptedScheduler(): Scheduler {
  let getCurrentTime: Scheduler['getCurrentTime'];
  let requestCallback: Scheduler['requestCallback'];
  let shouldYieldToMain: Scheduler['shouldYieldToMain'];
  let yieldToMain: Scheduler['yieldToMain'];

  if (typeof globalThis.performance?.now === 'function') {
    getCurrentTime = () => performance.now();
  } else {
    getCurrentTime = () => Date.now();
  }

  if (typeof globalThis.scheduler?.postTask === 'function') {
    requestCallback = (callback, options) =>
      scheduler.postTask(callback, options);
  } else {
    const requestIdleCallback =
      typeof globalThis.requestIdleCallback === 'function'
        ? globalThis.requestIdleCallback
        : setTimeout;
    requestCallback = (callback, options) => {
      switch (options?.priority) {
        case 'user-blocking':
          return new Promise((resolve, reject) => {
            queueMicrotask(() => {
              invokeCallback(callback, resolve, reject);
            });
          });
        case 'background':
          return new Promise((resolve, reject) => {
            requestIdleCallback(() => {
              invokeCallback(callback, resolve, reject);
            });
          });
        default:
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              invokeCallback(callback, resolve, reject);
            });
          });
      }
    };
  }

  if (typeof globalThis.navigator?.scheduling.isInputPending === 'function') {
    shouldYieldToMain = (elapsedTime) => {
      if (elapsedTime < FRAME_YIELD_INTERVAL) {
        return false;
      }
      if (elapsedTime < MAX_YIELD_INTERVAL) {
        const includeContinuous = elapsedTime >= CONTINUOUS_INPUT_INTERVAL;
        return navigator.scheduling.isInputPending({ includeContinuous });
      }
      return true;
    };
  } else {
    shouldYieldToMain = (elapsedTime) => {
      if (elapsedTime < FRAME_YIELD_INTERVAL) {
        return false;
      }
      return true;
    };
  }

  if (typeof globalThis.scheduler?.yield === 'function') {
    yieldToMain = (options) => scheduler.yield(options);
  } else {
    yieldToMain = () => new Promise(queueMicrotask);
  }

  return {
    getCurrentTime,
    requestCallback,
    shouldYieldToMain,
    yieldToMain,
  };
}

export function isHigherPriority(
  first: TaskPriority,
  second: TaskPriority,
): boolean {
  return first !== second
    ? getPriorityNumber(first) < getPriorityNumber(second)
    : false;
}

function getPriorityNumber(priority: TaskPriority): number {
  switch (priority) {
    case 'user-blocking':
      return 0;
    case 'user-visible':
      return 1;
    case 'background':
      return 2;
  }
}

function invokeCallback<T>(
  callback: () => T | PromiseLike<T>,
  resolve: (value: T) => void,
  reject: (reason?: any) => void,
): void {
  try {
    const result = callback();
    if (isPromiseLike(result)) {
      result.then(resolve, reject);
    } else {
      resolve(result);
    }
  } catch (error) {
    reject(error);
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return value !== null && typeof value === 'object' && 'then' in value;
}
