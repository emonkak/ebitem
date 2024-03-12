import { assert } from 'chai';

import { AtomSignal, ComputedSignal, MemoizedSignal } from '../src/signal.js';

describe('AtomSignal', () => {
  it('should get 1 of the initial version on initalize', () => {
    const signal = new AtomSignal('foo');

    assert.strictEqual(signal.value, 'foo');
    assert.strictEqual(signal.version, 1);
  });

  it('should increment the version on update', () => {
    const signal = new AtomSignal('foo');

    signal.value = 'bar';
    assert.strictEqual(signal.value, 'bar');
    assert.strictEqual(signal.version, 2);
  });

  describe('.update()', () => {
    it('should increment the version on update', () => {
      const signal = new AtomSignal(1);

      signal.update((n) => n + 1);

      assert.strictEqual(2, signal.value);
      assert.strictEqual(2, signal.version);
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      let count = 0;
      const signal = new AtomSignal('foo');

      signal.subscribe(() => {
        count++;
      });
      assert.strictEqual(count, 0);

      signal.value = 'bar';
      assert.strictEqual(count, 1);

      signal.value = 'baz';
      assert.strictEqual(count, 2);
    });

    it('should not invoke the unsubscribed callback', () => {
      let count = 0;
      const signal = new AtomSignal('foo');

      signal.subscribe(() => {
        count++;
      })();
      assert.strictEqual(count, 0);

      signal.value = 'bar';
      assert.strictEqual(count, 0);

      signal.value = 'baz';
      assert.strictEqual(count, 0);
    });
  });

  describe('.map()', () => {
    it('should create a new signal by applying the function to each values', () => {
      const signal = new AtomSignal(1);
      const doublySignal = signal.map((n) => n * 2);

      assert.strictEqual(doublySignal.value, 2);
      assert.strictEqual(doublySignal.version, 1);

      signal.value++;

      assert.strictEqual(doublySignal.value, 4);
      assert.strictEqual(doublySignal.version, 2);
    });
  });

  describe('.mutate()', () => {
    it('should increment the version if the callback returns no result', () => {
      const signal = new AtomSignal([1, 2]);

      signal.mutate((elements) => {
        elements.push(3);
      });

      assert.deepEqual([1, 2, 3], signal.value);
      assert.strictEqual(2, signal.version);
    });

    it('should increment the version if the callback returns ture', () => {
      const signal = new AtomSignal([1, 2]);

      signal.mutate((elements) => {
        elements.push(3);
        return true;
      });

      assert.deepEqual([1, 2, 3], signal.value);
      assert.strictEqual(2, signal.version);
    });

    it('should not increment the version if the callback returns false', () => {
      const signal = new AtomSignal([1, 2]);

      signal.mutate((elements) => {
        elements.push(3);
        return false;
      });

      assert.deepEqual([1, 2, 3], signal.value);
      assert.strictEqual(1, signal.version);
    });
  });

  describe('.toJSON()', () => {
    it('should return the value', () => {
      const signal = new AtomSignal('foo');

      assert.strictEqual('foo', signal.toJSON());
    });
  });

  describe('.valueOf()', () => {
    it('should return the value', () => {
      const signal = new AtomSignal('foo');

      assert.strictEqual('foo', signal.valueOf());
    });
  });
});

describe('ComputedSignal', () => {
  it('should create a signal from the closure', () => {
    let count = 0;
    const signal = new ComputedSignal(() => ++count, []);

    assert.strictEqual(signal.value, 1);
    assert.strictEqual(signal.value, 2);
    assert.strictEqual(signal.value, 3);
    assert.strictEqual(signal.version, 1);
  });

  it('should compute from other signals', () => {
    const first = new AtomSignal(1);
    const second = new AtomSignal(2);
    const third = new AtomSignal(3);

    const signal = new ComputedSignal(
      (first, second, third) => first.value + second.value + third.value,
      [first, second, third],
    );

    assert.strictEqual(signal.value, 6);
    assert.strictEqual(signal.version, 1);
  });

  it('should increment the version when any dependent signal has been updated', () => {
    const first = new AtomSignal(1);
    const second = new AtomSignal(2);
    const third = new AtomSignal(3);

    const signal = ComputedSignal.compose(
      (first, second, third) => first + second + third,
      [first, second, third],
    );

    first.value = 10;
    assert.strictEqual(signal.value, 15);
    assert.strictEqual(signal.version, 2);

    second.value = 20;
    assert.strictEqual(signal.value, 33);
    assert.strictEqual(signal.version, 3);

    third.value = 30;
    assert.strictEqual(signal.value, 60);
    assert.strictEqual(signal.version, 4);
  });

  describe('.compose()', () => {
    it('should compute from other signal values', () => {
      const first = new AtomSignal(1);
      const second = new AtomSignal(2);
      const third = new AtomSignal(3);

      const signal = ComputedSignal.compose(
        (first, second, third) => first + second + third,
        [first, second, third],
      );

      assert.strictEqual(signal.value, 6);
      assert.strictEqual(signal.version, 1);
    });
  });

  describe('.memoized()', () => {
    it('should create a memoized signal', () => {
      let count = 0;
      const signal = new ComputedSignal(() => ++count, []);
      const memoizedSignal = signal.memoized();

      assert.strictEqual(memoizedSignal.value, 1);
      assert.strictEqual(memoizedSignal.value, 1);
      assert.strictEqual(memoizedSignal.version, 1);
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      let count = 0;

      const first = new AtomSignal(1);
      const second = new AtomSignal(2);
      const third = new AtomSignal(3);

      const signal = new ComputedSignal(
        (first, second, third) => first.value + second.value + third.value,
        [first, second, third],
      );

      signal.subscribe(() => {
        count++;
      });
      assert.strictEqual(count, 0);

      first.value *= 2;
      assert.strictEqual(count, 1);

      second.value *= 2;
      assert.strictEqual(count, 2);

      third.value *= 2;
      assert.strictEqual(count, 3);
    });

    it('should not invoke the unsubscribed callback', () => {
      let count = 0;

      const first = new AtomSignal(1);
      const second = new AtomSignal(2);
      const third = new AtomSignal(3);

      const signal = new ComputedSignal(
        (first, second, third) => first.value + second.value + third.value,
        [first, second, third],
      );

      signal.subscribe(() => {
        count++;
      })();
      assert.strictEqual(count, 0);

      first.value *= 2;
      assert.strictEqual(count, 0);

      second.value *= 2;
      assert.strictEqual(count, 0);

      third.value *= 2;
      assert.strictEqual(count, 0);
    });
  });
});

describe('MemoizedSignal', () => {
  describe('should pass an initial value', () => {
    let count = 0;
    const first = new AtomSignal(1);
    const inner = new ComputedSignal(
      (first) => {
        ++count;
        return first.value;
      },
      [first],
    );
    const signal = new MemoizedSignal(inner, 1, 1);

    assert.strictEqual(signal.value, 1);
    assert.strictEqual(signal.version, 1);
    assert.strictEqual(count, 0);

    first.value++;

    assert.strictEqual(signal.value, 2);
    assert.strictEqual(signal.version, 2);
    assert.strictEqual(count, 1);
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      let count = 0;

      const first = new AtomSignal(1);
      const signal = new MemoizedSignal(first);

      signal.subscribe(() => {
        count++;
      });
      assert.strictEqual(count, 0);

      first.value++;
      assert.strictEqual(count, 1);

      first.value++;
      assert.strictEqual(count, 2);
    });

    it('should not invoke the unsubscribed callback', () => {
      let count = 0;

      const first = new AtomSignal(1);
      const signal = new MemoizedSignal(first);

      signal.subscribe(() => {
        count++;
      })();
      assert.strictEqual(count, 0);

      first.value++;
      assert.strictEqual(count, 0);

      first.value++;
      assert.strictEqual(count, 0);
    });
  });
});
