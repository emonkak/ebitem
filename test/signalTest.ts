import { assert } from 'chai';

import { AtomSignal, ComputedSignal } from '../src/signal.js';

describe('AtomSignal', () => {
  it('should get 0 of the initial version on initalize', () => {
    const signal = new AtomSignal('foo');

    assert.strictEqual(signal.value, 'foo');
    assert.strictEqual(signal.version, 0);
  });

  it('should increment the version on update', () => {
    const signal = new AtomSignal('foo');

    signal.value = 'bar';
    assert.strictEqual(signal.value, 'bar');
    assert.strictEqual(signal.version, 1);
  });

  describe('.forceUpdate()', () => {
    it('should increment the version', () => {
      const signal = new AtomSignal(1);

      signal.forceUpdate();

      assert.strictEqual(1, signal.value);
      assert.strictEqual(1, signal.version);
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
      assert.strictEqual(doublySignal.version, 0);

      signal.value++;

      assert.strictEqual(doublySignal.value, 4);
      assert.strictEqual(doublySignal.version, 1);
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
  it('should return a memoized value', () => {
    const foo = new AtomSignal(1);
    const bar = new AtomSignal(2);
    const baz = new AtomSignal(3);

    const signal = new ComputedSignal(
      (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
      [foo, bar, baz],
    );

    assert.deepEqual(signal.value, { foo: 1, bar: 2, baz: 3 });
    assert.strictEqual(signal.value, signal.value);
    assert.strictEqual(signal.version, 0);
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
    assert.deepEqual(signal.value, { foo: 10, bar: 2, baz: 3 });
    assert.strictEqual(signal.version, 1);

    let oldValue = signal.value;

    bar.value = 20;
    assert.deepEqual(signal.value, { foo: 10, bar: 20, baz: 3 });
    assert.notStrictEqual(signal.value, oldValue);
    assert.strictEqual(signal.version, 2);

    oldValue = signal.value;

    baz.value = 30;
    assert.deepEqual(signal.value, { foo: 10, bar: 20, baz: 30 });
    assert.notStrictEqual(signal.value, oldValue);
    assert.strictEqual(signal.version, 3);
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

      assert.deepEqual(signal.value, { foo: 1, bar: 2, baz: 3 });
      assert.strictEqual(signal.value, signal.value);
      assert.strictEqual(signal.version, 0);
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
      assert.strictEqual(count, 0);

      foo.value++;
      assert.strictEqual(count, 1);

      bar.value++;
      assert.strictEqual(count, 2);

      baz.value++;
      assert.strictEqual(count, 3);
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
      assert.strictEqual(count, 0);

      foo.value++;
      assert.strictEqual(count, 0);

      bar.value++;
      assert.strictEqual(count, 0);

      baz.value++;
      assert.strictEqual(count, 0);
    });
  });
});
