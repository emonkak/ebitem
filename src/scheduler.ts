export interface Scheduler {
  getCurrentTime(): number;
  postRenderingTask<T>(task: Task<T>): Promise<T>;
  postBlockingTask<T>(task: Task<T>): Promise<T>;
  postBackgroundTask<T>(task: Task<T>): Promise<T>;
  shouldYieldToMain(startTime: number): boolean;
  yieldToMain(): Promise<void>;
}

export type Task<T> = () => Promise<T>;

const FRAME_INTERVAL = 5;
const CONTINUOUS_INPUT_INTERVAL = 50;
const MAX_YIELD_INTERVAL = 300;

export function createAdaptedScheduler(): Scheduler {
  let getCurrentTime: Scheduler['getCurrentTime'];
  let postRenderingTask: Scheduler['postRenderingTask'];
  let postBlockingTask: Scheduler['postBlockingTask'];
  let postBackgroundTask: Scheduler['postBackgroundTask'];
  let shouldYieldToMain: Scheduler['shouldYieldToMain'];
  let yieldToMain: Scheduler['yieldToMain'];

  if (typeof globalThis?.performance?.now === 'function') {
    getCurrentTime = () => performance.now();
  } else {
    getCurrentTime = () => Date.now();
  }

  postRenderingTask = (task) =>
    new Promise((resolve, reject) => {
      queueMicrotask(() => task().then(resolve, reject));
    });

  if (typeof globalThis?.scheduler?.postTask === 'function') {
    postBlockingTask = (task) =>
      scheduler.postTask(task, {
        priority: 'user-blocking',
      });
    postBackgroundTask = (task) =>
      scheduler.postTask(task, {
        priority: 'background',
      });
  } else {
    postBlockingTask = (task) =>
      new Promise((resolve, reject) => {
        requestAnimationFrame(() => task().then(resolve, reject));
      });
    if (typeof globalThis?.requestIdleCallback === 'function') {
      postBackgroundTask = (task) =>
        new Promise((resolve, reject) => {
          requestIdleCallback(() => task().then(resolve, reject));
        });
    } else {
      postBackgroundTask = (task) =>
        new Promise((resolve, reject) => {
          queueMicrotask(() => task().then(resolve, reject));
        });
    }
  }

  if (typeof globalThis?.navigator?.scheduling.isInputPending === 'function') {
    shouldYieldToMain = function (this: Scheduler, startTime) {
      const elapsedTime = this.getCurrentTime() - startTime;
      if (elapsedTime < FRAME_INTERVAL) {
        return false;
      }
      if (elapsedTime < CONTINUOUS_INPUT_INTERVAL) {
        return navigator.scheduling.isInputPending({
          includeContinuous: false,
        });
      }
      if (elapsedTime < MAX_YIELD_INTERVAL) {
        return navigator.scheduling.isInputPending({ includeContinuous: true });
      }
      return true;
    };
  } else {
    shouldYieldToMain = function (this: Scheduler, startTime) {
      const elapsedTime = this.getCurrentTime() - startTime;
      return elapsedTime >= FRAME_INTERVAL;
    };
  }

  if (typeof globalThis?.scheduler?.yield === 'function') {
    yieldToMain = () => scheduler.yield();
  } else {
    yieldToMain = () => new Promise(queueMicrotask);
  }

  return {
    getCurrentTime,
    postRenderingTask,
    postBlockingTask,
    postBackgroundTask,
    shouldYieldToMain,
    yieldToMain,
  };
}
