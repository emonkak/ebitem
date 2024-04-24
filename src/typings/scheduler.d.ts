interface SchedulerPostTaskOptions {
  delay?: number;
  priority?: TaskPriority;
  signal?: AbortSignal;
}

interface Scheduler {
  postTask<T>(
    callback: (...params: P) => T | PromiseLike<T>,
    options?: SchedulerPostTaskOptions,
  ): Promise<T>;
  yield(): Promise<void>;
}

declare var Scheduler: {
  prototype: Scheduler;
  new (): Scheduler;
};

declare var scheduler: Scheduler;

interface TaskSignal extends AbortSignal {
  readonly priority: TaskPriority;
  onprioritychange: ((this: TaskSignal, ev: Event) => any) | null;
  addEventListener<K extends keyof TaskSignalEventMap>(
    type: K,
    listener: (this: TaskSignal, ev: TaskSignalEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof TaskSignalEventMap>(
    type: K,
    listener: (this: TaskSignal, ev: TaskSignalEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void;
}

declare var TaskSignal: {
  prototype: TaskSignal;
  new (): TaskSignal;
};

interface TaskSignalEventMap {
  prioritychange: Event;
}

type TaskPriority = 'user-blocking' | 'user-visible' | 'background';
