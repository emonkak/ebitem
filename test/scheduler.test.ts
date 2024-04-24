import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdaptedScheduler } from '../src/scheduler.js';

describe('getCurrentTime()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('using performance.now()', () => {
    beforeEach(() => {
      vi.stubGlobal('performance', {
        now() {
          return Date.now();
        },
      } as Partial<Performance>);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return the current time', () => {
      const now = Date.now();
      const spy = vi.spyOn(performance, 'now').mockReturnValue(now);
      const adaptedScheduler = createAdaptedScheduler();
      expect(adaptedScheduler.getCurrentTime()).toBe(now);
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('using Date.now()', () => {
    beforeEach(() => {
      vi.stubGlobal('performance', {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return the current time', () => {
      const now = Date.now();
      const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
      const adaptedScheduler = createAdaptedScheduler();
      expect(adaptedScheduler.getCurrentTime()).toBe(now);
      expect(spy).toHaveBeenCalledOnce();
    });
  });
});

describe('postRenderingTask()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should schedule the task as a microtask', () => {
    const result = {};
    const task = () => Promise.resolve(result);
    const queueMicrotaskSpy = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation((callback) => {
        callback();
      });
    const adaptedScheduler = createAdaptedScheduler();
    expect(adaptedScheduler.postRenderingTask(task)).resolves.toBe(result);
    expect(queueMicrotaskSpy).toHaveBeenCalledOnce();
  });
});

describe('postBlockingTask()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('using scheduler.postTask()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {
        postTask(callback) {
          return callback();
        },
      } as Partial<Scheduler>);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should schedule the task in user-blocking priority', () => {
      const result = {};
      const task = () => Promise.resolve(result);
      const postTaskSpy = vi.spyOn(scheduler, 'postTask');
      const adaptedScheduler = createAdaptedScheduler();
      expect(adaptedScheduler.postBlockingTask(task)).resolves.toBe(result);
      expect(postTaskSpy).toHaveBeenCalledWith(
        task,
        expect.objectContaining({ priority: 'user-blocking' }),
      );
      expect(postTaskSpy).toHaveBeenCalledOnce();
    });
  });

  describe('using requestAnimationFrame()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should schedule the task', () => {
      const result = {};
      const task = () => Promise.resolve(result);
      const queueMicrotaskSpy = vi
        .spyOn(globalThis, 'requestAnimationFrame')
        .mockImplementation((callback) => {
          callback(0);
          return 0;
        });
      const adaptedScheduler = createAdaptedScheduler();
      expect(adaptedScheduler.postBlockingTask(task)).resolves.toBe(result);
      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('postBackgroundTask()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('using scheduler.postTask()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {
        postTask(callback) {
          return callback();
        },
      } as Partial<Scheduler>);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should schedule the task in user-blocking priority', () => {
      const result = {};
      const task = () => Promise.resolve(result);
      const postTaskSpy = vi.spyOn(scheduler, 'postTask');
      const adaptedScheduler = createAdaptedScheduler();
      expect(adaptedScheduler.postBackgroundTask(task)).resolves.toBe(result);
      expect(postTaskSpy).toHaveBeenCalledWith(
        task,
        expect.objectContaining({ priority: 'background' }),
      );
      expect(postTaskSpy).toHaveBeenCalledOnce();
    });
  });

  describe('using requestIdleCallback()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {});
      vi.stubGlobal('requestIdleCallback', ((callback) => {
        callback({} as IdleDeadline);
        return 0;
      }) as typeof requestIdleCallback);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should schedule the task as an idle callback', () => {
      const result = {};
      const task = () => Promise.resolve(result);
      const requestIdleCallbackSpy = vi.spyOn(
        globalThis,
        'requestIdleCallback',
      );
      const adaptedScheduler = createAdaptedScheduler();
      expect(adaptedScheduler.postBackgroundTask(task)).resolves.toBe(result);
      expect(requestIdleCallbackSpy).toHaveBeenCalledOnce();
    });
  });

  describe('using queueMicrotask()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {});
      vi.stubGlobal('requestIdleCallback', undefined);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should schedule the task as a microtask', () => {
      const result = {};
      const task = () => Promise.resolve(result);
      const queueMicrotaskSpy = vi
        .spyOn(globalThis, 'queueMicrotask')
        .mockImplementation((callback) => {
          callback();
        });
      const adaptedScheduler = createAdaptedScheduler();
      expect(adaptedScheduler.postBackgroundTask(task)).resolves.toBe(result);
      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('shouldYieldToMain()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('using isInputPending()', () => {
    beforeEach(() => {
      vi.stubGlobal('navigator', {
        scheduling: {
          isInputPending() {
            return false;
          },
        } as Partial<Scheduling>,
      } as Partial<Navigator>);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return false if the elapsed time is less than 5ms', () => {
      const adaptedScheduler = createAdaptedScheduler();

      const getCurrentTimeSpy1 = vi
        .spyOn(adaptedScheduler, 'getCurrentTime')
        .mockReturnValue(0);
      expect(adaptedScheduler.shouldYieldToMain(0)).toBe(false);
      expect(getCurrentTimeSpy1).toHaveBeenCalledOnce();

      const getCurrentTimeSpy2 = vi
        .spyOn(adaptedScheduler, 'getCurrentTime')
        .mockReturnValue(4);
      expect(adaptedScheduler.shouldYieldToMain(0)).toBe(false);
      expect(getCurrentTimeSpy2).toHaveBeenCalledOnce();
    });

    it('should return the result of isInputPending() without continuous events if the elapsed time is between 5ms and 49ms', () => {
      const adaptedScheduler = createAdaptedScheduler();
      const isInputPendingSpy = vi
        .spyOn(navigator.scheduling, 'isInputPending')
        .mockReturnValue(false);

      const getCurrentTimeSpy1 = vi
        .spyOn(adaptedScheduler, 'getCurrentTime')
        .mockReturnValue(5);
      expect(adaptedScheduler.shouldYieldToMain(0)).toBe(false);
      expect(getCurrentTimeSpy1).toHaveBeenCalledOnce();
      expect(isInputPendingSpy).toHaveBeenCalledTimes(1);
      expect(isInputPendingSpy).toHaveBeenLastCalledWith({
        includeContinuous: false,
      });

      const getCurrentTimeSpy2 = vi
        .spyOn(adaptedScheduler, 'getCurrentTime')
        .mockReturnValue(49);
      expect(adaptedScheduler.shouldYieldToMain(0)).toBe(false);
      expect(getCurrentTimeSpy2).toHaveBeenCalledOnce();
      expect(isInputPendingSpy).toHaveBeenCalledTimes(2);
      expect(isInputPendingSpy).toHaveBeenLastCalledWith({
        includeContinuous: false,
      });
    });

    it('should return the result of isInputPending() with continuous events if the elapsed time is between 50ms and 299ms', () => {
      const adaptedScheduler = createAdaptedScheduler();
      const isInputPendingSpy = vi
        .spyOn(navigator.scheduling, 'isInputPending')
        .mockReturnValue(false);

      const getCurrentTimeSpy1 = vi
        .spyOn(adaptedScheduler, 'getCurrentTime')
        .mockReturnValue(50);
      expect(adaptedScheduler.shouldYieldToMain(0)).toBe(false);
      expect(getCurrentTimeSpy1).toHaveBeenCalledOnce();
      expect(isInputPendingSpy).toHaveBeenCalledTimes(1);
      expect(isInputPendingSpy).toHaveBeenLastCalledWith({
        includeContinuous: true,
      });

      const getCurrentTimeSpy2 = vi
        .spyOn(adaptedScheduler, 'getCurrentTime')
        .mockReturnValue(299);
      expect(adaptedScheduler.shouldYieldToMain(0)).toBe(false);
      expect(getCurrentTimeSpy2).toHaveBeenCalledOnce();
      expect(isInputPendingSpy).toHaveBeenCalledTimes(2);
      expect(isInputPendingSpy).toHaveBeenLastCalledWith({
        includeContinuous: true,
      });
    });

    it('should return true if the elapsed time is greater than or equal to 300ms', () => {
      const adaptedScheduler = createAdaptedScheduler();
      const getCurrentTimeSpy = vi
        .spyOn(adaptedScheduler, 'getCurrentTime')
        .mockReturnValue(300);
      expect(adaptedScheduler.shouldYieldToMain(0)).toBe(true);
      expect(getCurrentTimeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('not using isInputPending()', () => {
    beforeEach(() => {
      vi.stubGlobal('navigator', {
        scheduling: {},
      } as Partial<Navigator>);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return true if the elapsed time is greater than or equal to 5ms', () => {
      const adaptedScheduler = createAdaptedScheduler();

      const getCurrentTimeSpy1 = vi
        .spyOn(adaptedScheduler, 'getCurrentTime')
        .mockReturnValue(0);
      expect(adaptedScheduler.shouldYieldToMain(0)).toBe(false);
      expect(getCurrentTimeSpy1).toHaveBeenCalledOnce();

      const getCurrentTimeSpy2 = vi
        .spyOn(adaptedScheduler, 'getCurrentTime')
        .mockReturnValue(4);
      expect(adaptedScheduler.shouldYieldToMain(0)).toBe(false);
      expect(getCurrentTimeSpy2).toHaveBeenCalledOnce();

      const getCurrentTimeSpy3 = vi
        .spyOn(adaptedScheduler, 'getCurrentTime')
        .mockReturnValue(5);
      expect(adaptedScheduler.shouldYieldToMain(0)).toBe(true);
      expect(getCurrentTimeSpy3).toHaveBeenCalledOnce();
    });
  });
});

describe('yieldToMain()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('using scheduler.yield()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {
        yield() {
          return new Promise<void>(queueMicrotask);
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return the promise of scheduler.yield()', () => {
      const adaptedScheduler = createAdaptedScheduler();
      const yieldSpy = vi
        .spyOn(scheduler, 'yield')
        .mockReturnValue(Promise.resolve());
      expect(adaptedScheduler.yieldToMain()).resolves.toBeUndefined();
      expect(yieldSpy).toHaveBeenCalledOnce();
    });
  });

  describe('using queueMicrotask()', () => {
    beforeEach(() => {
      vi.stubGlobal('scheduler', {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should wait until the current task has completed', () => {
      const adaptedScheduler = createAdaptedScheduler();
      const queueMicrotaskSpy = vi
        .spyOn(globalThis, 'queueMicrotask')
        .mockImplementation((callback) => {
          callback();
        });
      expect(adaptedScheduler.yieldToMain()).resolves.toBeUndefined();
      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();
    });
  });
});
