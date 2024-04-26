import { describe, expect, it } from 'vitest';

import { AtomSignal, ComputedSignal } from '../src/signal.js';

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

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      let count = 0;
      const signal = new AtomSignal('foo');

      signal.subscribe(() => {
        count++;
      });
      expect(count).toBe(0);

      signal.value = 'bar';
      expect(count).toBe(1);

      signal.value = 'baz';
      expect(count).toBe(2);
    });

    it('should not invoke the unsubscribed callback', () => {
      let count = 0;
      const signal = new AtomSignal('foo');

      signal.subscribe(() => {
        count++;
      })();
      expect(count).toBe(0);

      signal.value = 'bar';
      expect(count).toBe(0);

      signal.value = 'baz';
      expect(count).toBe(0);
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

  describe('.compose()', () => {
    it('should return a memoized value', () => {
      const foo = new AtomSignal(1);
      const bar = new AtomSignal(2);
      const baz = new AtomSignal(3);

      const signal = ComputedSignal.compose(
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
      let count = 0;

      const foo = new AtomSignal(1);
      const bar = new AtomSignal(2);
      const baz = new AtomSignal(3);

      const signal = new ComputedSignal(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      signal.subscribe(() => {
        count++;
      });
      expect(count).toBe(0);

      foo.value++;
      expect(count).toBe(1);

      bar.value++;
      expect(count).toBe(2);

      baz.value++;
      expect(count).toBe(3);
    });

    it('should not invoke the unsubscribed callback', () => {
      let count = 0;

      const foo = new AtomSignal(1);
      const bar = new AtomSignal(2);
      const baz = new AtomSignal(3);

      const signal = new ComputedSignal(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      signal.subscribe(() => {
        count++;
      })();
      expect(count).toBe(0);

      foo.value++;
      expect(count).toBe(0);

      bar.value++;
      expect(count).toBe(0);

      baz.value++;
      expect(count).toBe(0);
    });
  });
});
