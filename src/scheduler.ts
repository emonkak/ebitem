export interface Scheduler {
  getCurrentTime(): number;
  postRenderingTask(task: Task): Promise<void>;
  postBlockingTask(task: Task): Promise<void>;
  postBackgroundTask(task: Task): Promise<void>;
  shouldYieldToMain(startTime: number): boolean;
  yieldToMain(): Promise<void>;
}

export type Task = () => Promise<void>;

const FRAME_INTERVAL = 5;
const CONTINUOUS_INPUT_INTERVAL = 50;
const MAX_YIELD_INTERVAL = 300;

export function getDefaultScheduler(): Scheduler {
  let getCurrentTime: Scheduler['getCurrentTime'];
  let postRenderingTask: Scheduler['postRenderingTask'];
  let postBlockingTask: Scheduler['postBlockingTask'];
  let postBackgroundTask: Scheduler['postBackgroundTask'];
  let shouldYieldToMain: Scheduler['shouldYieldToMain'];
  let yieldToMain: Scheduler['yieldToMain'];

  if ('performance' in globalThis && 'now' in performance) {
    getCurrentTime = () => performance.now();
  } else {
    getCurrentTime = () => Date.now();
  }

  if ('scheduler' in globalThis && 'postTask' in scheduler) {
    postRenderingTask = (task) =>
      new Promise((resolve, reject) => {
        scheduler.postTask(() => task().then(resolve, reject), {
          priority: 'user-visible',
        });
      });
    postBlockingTask = (task) =>
      new Promise((resolve, reject) => {
        scheduler.postTask(() => task().then(resolve, reject), {
          priority: 'user-blocking',
        });
      });
    postBackgroundTask = (task) =>
      new Promise((resolve, reject) => {
        scheduler.postTask(() => task().then(resolve, reject), {
          priority: 'background',
        });
      });
  } else {
    postRenderingTask = (task) =>
      new Promise((resolve, reject) => {
        queueMicrotask(() => task().then(resolve, reject));
      });
    if ('requestAnimationFrame' in globalThis) {
      postBlockingTask = (task) =>
        new Promise((resolve, reject) => {
          requestAnimationFrame(() => task().then(resolve, reject));
        });
    } else {
      postBlockingTask = postRenderingTask;
    }
    if ('requestIdleCallback' in globalThis) {
      postBackgroundTask = (task) =>
        new Promise((resolve, reject) => {
          requestIdleCallback(() => task().then(resolve, reject));
        });
    } else {
      postBackgroundTask = postRenderingTask;
    }
  }

  if (
    'navigator' in globalThis &&
    'scheduling' in navigator &&
    'isInputPending' in navigator.scheduling
  ) {
    shouldYieldToMain = (startTime) => {
      const elapsedTime = getCurrentTime() - startTime;
      if (elapsedTime < FRAME_INTERVAL) {
        return false;
      }
      if (elapsedTime < CONTINUOUS_INPUT_INTERVAL) {
        return navigator.scheduling.isInputPending();
      }
      if (elapsedTime < MAX_YIELD_INTERVAL) {
        return navigator.scheduling.isInputPending({ includeContinuous: true });
      }
      return true;
    };
  } else {
    shouldYieldToMain = (startTime) => {
      const elapsedTime = getCurrentTime() - startTime;
      return elapsedTime >= FRAME_INTERVAL;
    };
  }

  if ('scheduler' in globalThis && 'yield' in scheduler) {
    yieldToMain = () => scheduler.yield();
  } else {
    yieldToMain = () =>
      new Promise((resolve) => {
        queueMicrotask(resolve);
      });
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
