export interface Scheduler {
  postRenderingTask(task: Task): Promise<void>;
  postBlockingTask(task: Task): Promise<void>;
  postBackgroundTask(task: Task): Promise<void>;
}

export type Task = () => Promise<void>;

export function getDefaultScheduler(): Scheduler {
  if ('scheduler' in globalThis && 'postTask' in scheduler) {
    return ptsScheduler;
  }
  if ('requestIdleCallback' in globalThis) {
    return idleScheduler;
  }
  return microtaskScheduler;
}

// PTS = Prioritized Task Scheduling
export const ptsScheduler: Scheduler = {
  postRenderingTask(task) {
    return new Promise((resolve, reject) => {
      scheduler.postTask(() => task().then(resolve, reject), {
        priority: 'background',
      });
    });
  },
  postBlockingTask(task) {
    return new Promise((resolve, reject) => {
      scheduler.postTask(() => task().then(resolve, reject), {
        priority: 'user-blocking',
      });
    });
  },
  postBackgroundTask(task) {
    return new Promise((resolve, reject) => {
      scheduler.postTask(() => task().then(resolve, reject), {
        priority: 'background',
      });
    });
  },
};

export const idleScheduler: Scheduler = {
  postRenderingTask(task) {
    return new Promise((resolve, reject) => {
      requestIdleCallback(() => task().then(resolve, reject));
    });
  },
  postBlockingTask(task) {
    return new Promise((resolve, reject) => {
      requestAnimationFrame(() => task().then(resolve, reject));
    });
  },
  postBackgroundTask(task) {
    return new Promise((resolve, reject) => {
      requestIdleCallback(() => task().then(resolve, reject));
    });
  },
};

export const microtaskScheduler: Scheduler = {
  postRenderingTask(task) {
    return Promise.resolve().then(() => task());
  },
  postBlockingTask(task) {
    return new Promise((resolve, reject) => {
      requestAnimationFrame(() => task().then(resolve, reject));
    });
  },
  postBackgroundTask(task) {
    return Promise.resolve().then(() => task());
  },
};
