import { assert } from 'chai';

import {
  ComputedSignal,
  MemoizedSignal,
  TrackingSignal,
  array,
  atom,
  struct,
} from '../src/signal.js';

describe('ArraySignal', () => {
  it('should get 1 of the initial version on initalize', () => {
    const signal = array(['foo', 'bar', 'baz']);

    assert.deepEqual(signal.value, ['foo', 'bar', 'baz']);
    assert.strictEqual(signal.version, 1);
  });

  describe('.mutate()', () => {
    it('should increment the version when an element has been added by push()', () => {
      const signal = array<string>([]);

      signal.mutate((elements) => {
        elements.push('foo');
      });
      assert.deepEqual(signal.value, ['foo']);
      assert.strictEqual(signal.version, 2);

      signal.mutate((elements) => {
        elements.push('bar');
      });
      assert.deepEqual(signal.value, ['foo', 'bar']);
      assert.strictEqual(signal.version, 3);

      signal.mutate((elements) => {
        elements.push('baz');
      });
      assert.deepEqual(signal.value, ['foo', 'bar', 'baz']);
      assert.strictEqual(signal.version, 4);
    });

    it('should increment the version when an element has been added by unshift()', () => {
      const signal = array<string>([]);

      signal.mutate((elements) => {
        elements.unshift('foo');
      });
      assert.deepEqual(signal.value, ['foo']);
      assert.strictEqual(signal.version, 2);

      signal.mutate((elements) => {
        elements.unshift('bar');
      });
      assert.deepEqual(signal.value, ['bar', 'foo']);
      assert.strictEqual(signal.version, 3);

      signal.mutate((elements) => {
        elements.unshift('baz');
      });
      assert.deepEqual(signal.value, ['baz', 'bar', 'foo']);
      assert.strictEqual(signal.version, 4);
    });

    it('should increment the version when elements have been changed by fill()', () => {
      const signal = array([1, 2, 3, 4, 5]);

      signal.mutate((elements) => {
        elements.fill(0);
      });
      assert.deepEqual(signal.value, [0, 0, 0, 0, 0]);
      assert.strictEqual(signal.version, 2);
    });

    it('should increment the version when elements have been changed by copyWithin()', () => {
      const signal = array([1, 2, 3, 4, 5]);

      signal.mutate((elements) => {
        elements.copyWithin(0, 3);
      });
      assert.deepEqual(signal.value, [4, 5, 3, 4, 5]);
      assert.strictEqual(signal.version, 2);
    });

    it('should increment the version when elements have been removed by splice()', () => {
      const signal = array(['foo', 'bar', 'baz']);

      signal.mutate((elements) => {
        elements.splice(1, 1);
      });
      assert.deepEqual(signal.value, ['foo', 'baz']);
      assert.strictEqual(signal.version, 2);

      signal.mutate((elements) => {
        elements.splice(0);
      });
      assert.deepEqual(signal.value, []);
      assert.strictEqual(signal.version, 3);
    });

    it('should increment the version when an element has been removed by pop()', () => {
      const signal = array(['foo', 'bar', 'baz']);

      signal.mutate((elements) => {
        elements.pop();
      });
      assert.deepEqual(signal.value, ['foo', 'bar']);
      assert.strictEqual(signal.version, 2);

      signal.mutate((elements) => {
        elements.pop();
      });
      assert.deepEqual(signal.value, ['foo']);
      assert.strictEqual(signal.version, 3);

      signal.mutate((elements) => {
        elements.pop();
      });
      assert.deepEqual(signal.value, []);
      assert.strictEqual(signal.version, 4);

      signal.mutate((elements) => {
        elements.pop();
      });
      assert.deepEqual(signal.value, []);
      assert.strictEqual(signal.version, 5);
    });

    it('should increment the version when an element has been removed by shift()', () => {
      const signal = array(['foo', 'bar', 'baz']);

      signal.mutate((elements) => {
        elements.shift();
      });
      assert.deepEqual(signal.value, ['bar', 'baz']);
      assert.strictEqual(signal.version, 2);

      signal.mutate((elements) => {
        elements.shift();
      });
      assert.deepEqual(signal.value, ['baz']);
      assert.strictEqual(signal.version, 3);

      signal.mutate((elements) => {
        elements.shift();
      });
      assert.deepEqual(signal.value, []);
      assert.strictEqual(signal.version, 4);

      signal.mutate((elements) => {
        elements.shift();
      });
      assert.deepEqual(signal.value, []);
      assert.strictEqual(signal.version, 5);
    });

    it('should increment the version when elements have been sorted', () => {
      const signal = array(['foo', 'bar', 'baz']);

      signal.mutate((elements) => {
        elements.sort();
      });
      assert.deepEqual(signal.value, ['bar', 'baz', 'foo']);
      assert.strictEqual(signal.version, 2);
    });

    it('should increment the version when elements have been reversed', () => {
      const signal = array(['foo', 'bar', 'baz']);

      signal.mutate((elements) => {
        elements.reverse();
      });
      assert.deepEqual(signal.value, ['baz', 'bar', 'foo']);
      assert.strictEqual(signal.version, 2);
    });

    it('should increment the version when the length has been changed', () => {
      const signal = array(['foo', 'bar', 'baz']);

      signal.mutate((elements) => {
        elements.length = 1;
      });
      assert.deepEqual(signal.value, ['foo']);
      assert.strictEqual(signal.version, 2);

      signal.mutate((elements) => {
        elements.length = 0;
      });
      assert.deepEqual(signal.value, []);
      assert.strictEqual(signal.version, 3);
    });

    it('should increment the version when an element has been changed', () => {
      const signal = array(['foo', 'bar', 'baz']);

      signal.mutate((elements) => {
        elements[0] = 'baz';
      });
      assert.deepEqual(signal.value, ['baz', 'bar', 'baz']);
      assert.strictEqual(signal.version, 2);

      signal.mutate((elements) => {
        elements[1] = 'bar';
      });
      assert.deepEqual(signal.value, ['baz', 'bar', 'baz']);
      assert.strictEqual(signal.version, 3);

      signal.mutate((elements) => {
        elements[2] = 'foo';
      });
      assert.deepEqual(signal.value, ['baz', 'bar', 'foo']);
      assert.strictEqual(signal.version, 4);
    });

    it('should increment the version when an element has been deleted', () => {
      const signal = array<string | undefined>(['foo', 'bar', 'baz']);

      signal.mutate((elements) => {
        delete elements[0];
      });
      assert.deepEqual(signal.value, [undefined, 'bar', 'baz']);
      assert.strictEqual(signal.version, 2);

      signal.mutate((elements) => {
        delete elements[1];
      });
      assert.deepEqual(signal.value, [undefined, undefined, 'baz']);
      assert.strictEqual(signal.version, 3);

      signal.mutate((elements) => {
        delete elements[2];
      });
      assert.deepEqual(signal.value, [undefined, undefined, undefined]);
      assert.strictEqual(signal.version, 4);
    });

    it('should increment the version when the array has been swapped', () => {
      const signal = array([1, 2, 3]);

      signal.value = [3, 2, 2];
      assert.deepEqual(signal.value, [3, 2, 2]);
      assert.strictEqual(signal.version, 2);
    });

    it('should batch multiple updates', () => {
      const signal = array([1, 2, 3, 4, 5]);

      signal.mutate((elements) => {
        elements.forEach((element, i) => (elements[i] = element * 2));
      });
      assert.deepEqual(signal.value, [2, 4, 6, 8, 10]);
      assert.strictEqual(signal.version, 2);
    });

    it('should increment the version if the callback returns ture', () => {
      const signal = array([1, 2, 3, 4, 5]);

      signal.mutate((_elements) => true);
      assert.deepEqual(signal.value, [1, 2, 3, 4, 5]);
      assert.strictEqual(signal.version, 2);
    });

    it('should not increment the version if the callback returns false', () => {
      const signal = array([1, 2, 3, 4, 5]);

      signal.mutate((elements) => {
        elements.push(6);
        return false;
      });
      assert.deepEqual(signal.value, [1, 2, 3, 4, 5, 6]);
      assert.strictEqual(signal.version, 1);
    });

    it('should not increment the version if there is no changes', () => {
      const signal = array([1, 2, 3, 4, 5]);

      signal.mutate((_elements) => {});
      assert.deepEqual(signal.value, [1, 2, 3, 4, 5]);
      assert.strictEqual(signal.version, 1);
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      let count = 0;
      const signal = array<string>([]);

      signal.subscribe(() => {
        count++;
      });
      assert.strictEqual(count, 0);

      signal.mutate((elements) => {
        elements.push('foo');
      });
      assert.strictEqual(count, 1);

      signal.mutate((elements) => {
        elements.push('bar');
      });
      assert.strictEqual(count, 2);

      signal.mutate((elements) => {
        elements.push('baz');
      });
      assert.strictEqual(count, 3);
    });

    it('should not invoke the unsubscribed callback', () => {
      let count = 0;
      const signal = array<string>([]);

      signal.subscribe(() => {
        count++;
      })();
      assert.strictEqual(count, 0);

      signal.mutate((elements) => {
        elements.push('foo');
      });
      assert.strictEqual(count, 0);

      signal.mutate((elements) => {
        elements.push('bar');
      });
      assert.strictEqual(count, 0);

      signal.mutate((elements) => {
        elements.push('baz');
      });
      assert.strictEqual(count, 0);
    });
  });
});

describe('AtomSignal', () => {
  it('should get 1 of the initial version on initalize', () => {
    const signal = atom('foo');

    assert.strictEqual(signal.value, 'foo');
    assert.strictEqual(signal.version, 1);
  });

  it('should increment the version on update', () => {
    const signal = atom('foo');

    signal.value = 'bar';
    assert.strictEqual(signal.value, 'bar');
    assert.strictEqual(signal.version, 2);
  });

  describe('.map()', () => {
    it('should create a new signal by applying the function to each values', () => {
      const signal = atom(1);
      const doublySignal = signal.map((n) => n * 2);

      assert.strictEqual(doublySignal.value, 2);
      assert.strictEqual(doublySignal.version, 1);

      signal.value++;

      assert.strictEqual(doublySignal.value, 4);
      assert.strictEqual(doublySignal.version, 2);
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      let count = 0;
      const signal = atom('foo');

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
      const signal = atom('foo');

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

  describe('.toJSON()', () => {
    it('should return the value', () => {
      const signal = atom('foo');

      assert.strictEqual('foo', signal.toJSON());
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
    const first = atom(1);
    const second = atom(2);
    const third = atom(3);

    const signal = new ComputedSignal(
      (first, second, third) => first.value + second.value + third.value,
      [first, second, third],
    );

    assert.strictEqual(signal.value, 6);
    assert.strictEqual(signal.version, 1);
  });

  it('should increment the version when any dependent signal has been updated', () => {
    const first = atom(1);
    const second = atom(2);
    const third = atom(3);

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
      const first = atom(1);
      const second = atom(2);
      const third = atom(3);

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

      const first = atom(1);
      const second = atom(2);
      const third = atom(3);

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

      const first = atom(1);
      const second = atom(2);
      const third = atom(3);

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
    const first = atom(1);
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

      const first = atom(1);
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

      const first = atom(1);
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

describe('StructSignal', () => {
  it('should get 1 of the initial version on initalize', () => {
    const value = {
      first: atom(1),
      second: atom(2),
      third: atom(3),
    };
    const signal = struct(value);

    assert.strictEqual(signal.value, value);
    assert.strictEqual(signal.version, 1);
  });

  it('should increment the version when any signal of the property has been updated', () => {
    const signal = struct({
      first: atom(1),
      second: atom(2),
      third: atom(3),
    });

    signal.value.first.value *= 2;
    assert.deepEqual(signal.flatten(), {
      first: 2,
      second: 2,
      third: 3,
    });
    assert.strictEqual(signal.version, 2);

    signal.value.second.value *= 2;
    assert.deepEqual(signal.flatten(), {
      first: 2,
      second: 4,
      third: 3,
    });
    assert.strictEqual(signal.version, 3);

    signal.value.third.value *= 2;
    assert.deepEqual(signal.flatten(), {
      first: 2,
      second: 4,
      third: 6,
    });
    assert.strictEqual(signal.version, 4);
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      let count = 0;

      const signal = struct({
        first: atom(1),
        second: atom(2),
        third: atom(3),
      });

      signal.subscribe(() => {
        count++;
      });
      assert.strictEqual(count, 0);

      signal.value.first.value *= 2;
      assert.strictEqual(count, 1);

      signal.value.second.value *= 2;
      assert.strictEqual(count, 2);

      signal.value.third.value *= 2;
      assert.strictEqual(count, 3);
    });

    it('should not invoke the unsubscribed callback', () => {
      let count = 0;

      const signal = struct({
        first: atom(1),
        second: atom(2),
        third: atom(3),
      });

      signal.subscribe(() => {
        count++;
      })();
      assert.strictEqual(count, 0);

      signal.value.first.value *= 2;
      assert.strictEqual(count, 0);

      signal.value.second.value *= 2;
      assert.strictEqual(count, 0);

      signal.value.third.value *= 2;
      assert.strictEqual(count, 0);
    });
  });
});

describe('TrackingSignal', () => {
  it('should get 1 of the initial version on initalize', () => {
    const state = {
      firstCounter: {
        count: atom(1),
      },
      secondCounter: atom(10),
      thirdCounter: 100,
    };

    const signal = new TrackingSignal(
      ({ firstCounter, secondCounter, thirdCounter }) =>
        firstCounter.count.value + secondCounter.value + thirdCounter,
      state,
    );

    // Access `.version` before `.value` for test coverage.
    assert.strictEqual(signal.version, 1);
    assert.strictEqual(signal.value, 111);
  });

  it('should increment the version when any signal of the property has been updated', () => {
    const state = {
      firstCounter: {
        count: atom(1),
      },
      secondCounter: atom(10),
      thirdCounter: 100,
    };

    const signal = new TrackingSignal(
      ({ firstCounter, secondCounter, thirdCounter }) =>
        firstCounter.count.value + secondCounter.value + thirdCounter,
      state,
    );

    assert.strictEqual(signal.value, 111);
    assert.strictEqual(signal.version, 1);

    state.firstCounter.count.value++;
    assert.strictEqual(signal.value, 112);
    assert.strictEqual(signal.version, 2);

    state.secondCounter.value++;
    assert.strictEqual(signal.value, 113);
    assert.strictEqual(signal.version, 3);
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      let count = 0;

      const state = {
        firstCounter: {
          count: atom(1),
        },
        secondCounter: atom(10),
        thirdCounter: 100,
      };

      const signal = new TrackingSignal(
        ({ firstCounter, secondCounter, thirdCounter }) =>
          firstCounter.count.value + secondCounter.value + thirdCounter,
        state,
      );

      signal.subscribe(() => {
        count++;
      });
      assert.strictEqual(count, 0);

      state.firstCounter.count.value++;
      assert.strictEqual(count, 1);

      state.secondCounter.value++;
      assert.strictEqual(count, 2);

      state.thirdCounter++;
      assert.strictEqual(count, 2);
    });

    it('should not invoke the unsubscribed callback', () => {
      let count = 0;

      const state = {
        firstCounter: {
          count: atom(1),
        },
        secondCounter: atom(10),
        thirdCounter: 100,
      };

      const signal = new TrackingSignal(
        ({ firstCounter, secondCounter, thirdCounter }) =>
          firstCounter.count.value + secondCounter.value + thirdCounter,
        state,
      );

      signal.subscribe(() => {
        count++;
      })();
      assert.strictEqual(count, 0);

      state.firstCounter.count.value++;
      assert.strictEqual(count, 0);

      state.secondCounter.value++;
      assert.strictEqual(count, 0);

      state.thirdCounter++;
      assert.strictEqual(count, 0);
    });
  });
});
