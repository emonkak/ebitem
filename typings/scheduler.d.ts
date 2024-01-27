interface SchedulerPostTaskOptions {
  delay?: number;
  priority?: TaskPriority;
  signal?: AbortSignal;
}

interface Scheduler {
  postTask<T, P extends readonly unknown[] | []>(
    callback: (...params: P) => T,
    options?: SchedulerPostTaskOptions,
    ...arguments: P
  ): Promise<T>;
  yield(): Promise<void>;
}

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
