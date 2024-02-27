import { assert } from 'chai';

import { LinkedList } from '../src/linkedList.js';

describe('LinkedList', () => {
  it('should create an empty list', () => {
    const list = new LinkedList();

    assert.equal(list.isEmpty(), true);
    assert.equal(list.front(), null);
    assert.equal(list.back(), null);
    assert.deepEqual(Array.from(list), []);
  });

  it('should prepend a single value to the list', () => {
    const list = new LinkedList();
    const foo = list.pushFront('foo');

    assert.equal(foo.value, 'foo');
    assert.equal(list.isEmpty(), false);
    assert.equal(list.front(), foo);
    assert.equal(list.back(), foo);
    assert.deepEqual(Array.from(list), ['foo']);
  });

  it('should append a single value to the list', () => {
    const list = new LinkedList();
    const foo = list.pushBack('foo');

    assert.equal(foo.value, 'foo');
    assert.equal(list.isEmpty(), false);
    assert.equal(list.front(), foo);
    assert.equal(list.back(), foo);
    assert.deepEqual(Array.from(list), ['foo']);
  });

  it('should prepend values to the list', () => {
    const list = new LinkedList();
    const foo = list.pushFront('foo');
    const bar = list.pushFront('bar');
    const baz = list.pushFront('baz');

    assert.equal(foo.value, 'foo');
    assert.equal(bar.value, 'bar');
    assert.equal(baz.value, 'baz');
    assert.equal(list.isEmpty(), false);
    assert.equal(list.front(), baz);
    assert.equal(list.back(), foo);
    assert.deepEqual(Array.from(list), ['baz', 'bar', 'foo']);
  });

  it('should append values to the list', () => {
    const list = new LinkedList();
    const foo = list.pushBack('foo');
    const bar = list.pushBack('bar');
    const baz = list.pushBack('baz');

    assert.equal(foo.value, 'foo');
    assert.equal(bar.value, 'bar');
    assert.equal(baz.value, 'baz');
    assert.equal(list.isEmpty(), false);
    assert.equal(list.front(), foo);
    assert.equal(list.back(), baz);
    assert.deepEqual(Array.from(list), ['foo', 'bar', 'baz']);
  });

  it('should remove values from the head', () => {
    const list = new LinkedList();
    const foo = list.pushBack('foo');
    const bar = list.pushBack('bar');
    const baz = list.pushBack('baz');

    assert.equal(list.popFront(), foo);
    assert.equal(list.isEmpty(), false);
    assert.equal(list.front(), bar);
    assert.equal(list.back(), baz);
    assert.deepEqual(Array.from(list), ['bar', 'baz']);

    assert.equal(list.popFront(), bar);
    assert.equal(list.isEmpty(), false);
    assert.equal(list.front(), baz);
    assert.equal(list.back(), baz);
    assert.deepEqual(Array.from(list), ['baz']);

    assert.equal(list.popFront(), baz);
    assert.equal(list.isEmpty(), true);
    assert.equal(list.front(), null);
    assert.equal(list.back(), null);
    assert.deepEqual(Array.from(list), []);
  });

  it('should remove values from the tail', () => {
    const list = new LinkedList();
    const foo = list.pushBack('foo');
    const bar = list.pushBack('bar');
    const baz = list.pushBack('baz');

    assert.equal(list.popBack(), baz);
    assert.equal(list.isEmpty(), false);
    assert.equal(list.front(), foo);
    assert.equal(list.back(), bar);
    assert.deepEqual(Array.from(list), ['foo', 'bar']);

    assert.equal(list.popBack(), bar);
    assert.equal(list.isEmpty(), false);
    assert.equal(list.front(), foo);
    assert.equal(list.back(), foo);
    assert.deepEqual(Array.from(list), ['foo']);

    assert.equal(list.popBack(), foo);
    assert.equal(list.isEmpty(), true);
    assert.equal(list.front(), null);
    assert.equal(list.back(), null);
    assert.deepEqual(Array.from(list), []);
  });

  it('should remove a value', () => {
    const list = new LinkedList();
    const foo = list.pushBack('foo');
    const bar = list.pushBack('bar');
    const baz = list.pushBack('baz');

    list.remove(bar);

    assert.equal(list.isEmpty(), false);
    assert.equal(list.front(), foo);
    assert.equal(list.back(), baz);
    assert.deepEqual(Array.from(list), ['foo', 'baz']);
  });

  it('should remove the head value', () => {
    const list = new LinkedList();
    const foo = list.pushBack('foo');
    const bar = list.pushBack('bar');
    const baz = list.pushBack('baz');

    assert.equal(list.popFront(), foo);
    assert.equal(list.popFront(), bar);
    assert.equal(list.popFront(), baz);
  });

  it('should remove the tail value', () => {
    const list = new LinkedList();
    const foo = list.pushBack('foo');
    const bar = list.pushBack('bar');
    const baz = list.pushBack('baz');

    assert.equal(list.popBack(), baz);
    assert.equal(list.popBack(), bar);
    assert.equal(list.popBack(), foo);

    assert.equal(list.isEmpty(), true);
    assert.equal(list.front(), null);
    assert.equal(list.back(), null);
    assert.deepEqual(Array.from(list), []);
  });

  it('should remove the last value', () => {
    const list = new LinkedList();
    const foo = list.pushBack('foo');

    list.remove(foo);

    assert.equal(list.isEmpty(), true);
    assert.equal(list.front(), null);
    assert.equal(list.back(), null);
    assert.deepEqual(Array.from(list), []);
  });
});
