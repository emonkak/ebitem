import { describe, expect, it, vi } from 'vitest';

import { Binding, NodeBinding, directiveTag } from '../src/binding.js';
import { Context } from '../src/context.js';
import { Hook, usableTag } from '../src/hook.js';
import { LocalScope } from '../src/localScope.js';
import { PartType } from '../src/part.js';
import { AtomSignal, ComputedSignal, SignalBinding } from '../src/signal.js';
import { SyncUpdater } from '../src/updater.js';
import { MockComponent } from './mocks.js';

describe('AtomSignal', () => {
  it('should get 0 of the initial version on initalize', () => {
    const signal = new AtomSignal('foo');

    expect(signal.value).toBe('foo');
    expect(signal.version).toBe(0);
  });

  it('should increment the version on update', () => {
    const signal = new AtomSignal('foo');

    signal.value = 'bar';
    expect(signal.value).toBe('bar');
    expect(signal.version).toBe(1);
  });

  describe('.forceUpdate()', () => {
    it('should increment the version', () => {
      const signal = new AtomSignal(1);

      signal.forceUpdate();

      expect(1).toBe(signal.value);
      expect(1).toBe(signal.version);
    });
  });

  describe('.setUntrackedValue()', () => {
    it('should set the new value without invoking the callback', () => {
      const callback = vi.fn();
      const signal = new AtomSignal('foo');

      signal.subscribe(callback);
      signal.setUntrackedValue('bar');

      expect(signal.value).toBe('bar');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const callback = vi.fn();
      const signal = new AtomSignal('foo');

      signal.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(0);

      signal.value = 'bar';
      expect(callback).toHaveBeenCalledTimes(1);

      signal.value = 'baz';
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not invoke the unsubscribed callback', () => {
      const callback = vi.fn();
      const signal = new AtomSignal('foo');

      signal.subscribe(callback)();
      expect(callback).not.toHaveBeenCalled();

      signal.value = 'bar';
      expect(callback).not.toHaveBeenCalled();

      signal.value = 'baz';
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('.map()', () => {
    it('should create a new signal by applying the function to each values', () => {
      const signal = new AtomSignal(1);
      const doublySignal = signal.map((n) => n * 2);

      expect(doublySignal.value).toBe(2);
      expect(doublySignal.version).toBe(0);

      signal.value++;

      expect(doublySignal.value).toBe(4);
      expect(doublySignal.version).toBe(1);
    });
  });

  describe('.toJSON()', () => {
    it('should return the value', () => {
      const signal = new AtomSignal('foo');

      expect('foo').toBe(signal.toJSON());
    });
  });

  describe('.valueOf()', () => {
    it('should return the value', () => {
      const signal = new AtomSignal('foo');

      expect('foo').toBe(signal.valueOf());
    });
  });

  describe('[directiveTag]()', () => {
    it('should construct SignalBinding', () => {
      const signal = new AtomSignal('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const updater = new SyncUpdater(new LocalScope());
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');
      const binding = signal[directiveTag](part, updater);
      const bindSpy = vi.spyOn(binding.valueBinding, 'bind');

      expect(binding).toBeInstanceOf(SignalBinding);
      expect(binding.value).toBe(signal);
      expect(binding.valueBinding).toBeInstanceOf(NodeBinding);
      expect(binding.valueBinding.value).toBe('foo');
      expect(bindSpy).not.toHaveBeenCalled();
      expect(scheduleUpdateSpy).not.toHaveBeenCalledOnce();

      signal.value = 'bar';

      expect(bindSpy).toHaveBeenCalledOnce();
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });
  });

  describe('[usableTag]()', () => {
    it('should should subscribe the signal and return the signal value', () => {
      const signal = new AtomSignal('foo');
      const component = new MockComponent();
      const hooks: Hook[] = [];
      const scope = new LocalScope();
      const updater = new SyncUpdater(scope);
      const context = new Context(component, hooks, scope, updater);
      const requestUpdateSpy = vi.spyOn(component, 'requestUpdate');
      const value = signal[usableTag](context);

      updater.flush();

      expect(value).toBe('foo');
      expect(requestUpdateSpy).not.toHaveBeenCalled();

      signal.value = 'bar';

      updater.flush();

      expect(requestUpdateSpy).toHaveBeenCalled();
    });
  });
});

describe('ComputedSignal', () => {
  it('should return a memoized value', () => {
    const foo = new AtomSignal(1);
    const bar = new AtomSignal(2);
    const baz = new AtomSignal(3);

    const signal = new ComputedSignal(
      (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
      [foo, bar, baz],
    );

    expect(signal.value).toEqual({ foo: 1, bar: 2, baz: 3 });
    expect(signal.value).toBe(signal.value);
    expect(signal.version).toBe(0);
  });

  it('should increment the version when any dependent signal has been updated', () => {
    const foo = new AtomSignal(1);
    const bar = new AtomSignal(2);
    const baz = new AtomSignal(3);

    const signal = new ComputedSignal(
      (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
      [foo, bar, baz],
    );

    foo.value = 10;
    expect(signal.value).toEqual({ foo: 10, bar: 2, baz: 3 });
    expect(signal.version).toBe(1);

    let oldValue = signal.value;

    bar.value = 20;
    expect(signal.value).toEqual({ foo: 10, bar: 20, baz: 3 });
    expect(signal.value).not.toBe(oldValue);
    expect(signal.version).toBe(2);

    oldValue = signal.value;

    baz.value = 30;
    expect(signal.value).toEqual({ foo: 10, bar: 20, baz: 30 });
    expect(signal.value).not.toBe(oldValue);
    expect(signal.version).toBe(3);
  });

  describe('.lift()', () => {
    it('should return a memoized value', () => {
      const foo = new AtomSignal(1);
      const bar = new AtomSignal(2);
      const baz = new AtomSignal(3);

      const signal = ComputedSignal.lift(
        (foo, bar, baz) => ({ foo, bar, baz }),
        [foo, bar, baz],
      );

      expect(signal.value).toEqual({ foo: 1, bar: 2, baz: 3 });
      expect(signal.value).toBe(signal.value);
      expect(signal.version).toBe(0);
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const callback = vi.fn();
      const foo = new AtomSignal(1);
      const bar = new AtomSignal(2);
      const baz = new AtomSignal(3);

      const signal = new ComputedSignal(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      signal.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(0);

      foo.value++;
      expect(callback).toHaveBeenCalledTimes(1);

      bar.value++;
      expect(callback).toHaveBeenCalledTimes(2);

      baz.value++;
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should not invoke the unsubscribed callback', () => {
      const callback = vi.fn();
      const foo = new AtomSignal(1);
      const bar = new AtomSignal(2);
      const baz = new AtomSignal(3);

      const signal = new ComputedSignal(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      signal.subscribe(callback)();
      expect(callback).not.toHaveBeenCalled();

      foo.value++;
      expect(callback).not.toHaveBeenCalled();

      bar.value++;
      expect(callback).not.toHaveBeenCalled();

      baz.value++;
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('SignalBinding', () => {
  describe('.constructor', () => {
    it('should construct a new SignalBinding', () => {
      const signal = new AtomSignal('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const valueBinding = new NodeBinding('foo', part) as Binding<string>;
      const updater = new SyncUpdater(new LocalScope());
      const binding = new SignalBinding(signal, valueBinding, updater);
      const bindSpy = vi.spyOn(valueBinding, 'bind');

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.valueBinding).toBe(valueBinding);
      expect(binding.value).toBe(signal);
      expect(bindSpy).not.toHaveBeenCalled();

      signal.value = 'bar';

      expect(bindSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should bind the value binding and resubscribe the signal', () => {
      const signal1 = new AtomSignal('foo');
      const signal2 = new AtomSignal('bar');
      const unsubscribe1Spy = vi.fn();
      const unsubscribe2Spy = vi.fn();
      const subscribe1Spy = vi
        .spyOn(signal1, 'subscribe')
        .mockReturnValue(unsubscribe1Spy);
      const subscribe2Spy = vi
        .spyOn(signal2, 'subscribe')
        .mockReturnValue(unsubscribe1Spy);
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const valueBinding = new NodeBinding('foo', part) as Binding<string>;
      const updater = new SyncUpdater(new LocalScope());
      const binding = new SignalBinding(signal1, valueBinding, updater);
      const bindSpy = vi.spyOn(valueBinding, 'bind');

      expect(valueBinding.value).toBe('foo');
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unsubscribe1Spy).not.toHaveBeenCalled();
      expect(unsubscribe2Spy).not.toHaveBeenCalled();
      expect(subscribe1Spy).toHaveBeenCalledOnce();
      expect(subscribe2Spy).not.toHaveBeenCalledOnce();

      binding.value = signal2;
      binding.bind(updater);

      expect(valueBinding.value).toBe('bar');
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unsubscribe1Spy).toHaveBeenCalledOnce();
      expect(unsubscribe2Spy).not.toHaveBeenCalled();
      expect(subscribe1Spy).toHaveBeenCalledOnce();
      expect(subscribe2Spy).toHaveBeenCalledOnce();
    });
  });

  describe('.unbind()', () => {
    it('should unbind the value binding and resubscribe the signal', () => {
      const signal = new AtomSignal('foo');
      const unsubscribeSpy = vi.fn();
      const subscribeSpy = vi
        .spyOn(signal, 'subscribe')
        .mockReturnValue(unsubscribeSpy);
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const valueBinding = new NodeBinding('foo', part) as Binding<string>;
      const updater = new SyncUpdater(new LocalScope());
      const binding = new SignalBinding(signal, valueBinding, updater);
      const unbindSpy = vi.spyOn(valueBinding, 'unbind');

      expect(unsubscribeSpy).not.toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledOnce();

      binding.unbind(updater);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unsubscribeSpy).toHaveBeenCalledOnce();
      expect(subscribeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the value binding and unsubscribe the signal', () => {
      const signal = new AtomSignal('foo');
      const unsubscribeSpy = vi.fn();
      const subscribeSpy = vi
        .spyOn(signal, 'subscribe')
        .mockReturnValue(unsubscribeSpy);
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const valueBinding = new NodeBinding('foo', part) as Binding<string>;
      const updater = new SyncUpdater(new LocalScope());
      const binding = new SignalBinding(signal, valueBinding, updater);
      const disconnectSpy = vi.spyOn(valueBinding, 'disconnect');

      expect(unsubscribeSpy).not.toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledOnce();

      binding.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(unsubscribeSpy).toHaveBeenCalledOnce();
      expect(subscribeSpy).toHaveBeenCalledOnce();
    });
  });
});
