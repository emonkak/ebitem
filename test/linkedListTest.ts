import { assert } from 'chai';

import { LinkedList } from '../src/linkedList.js';

test('LinkedList.pushFront()', () => {
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

  list.remove(bar);
  assert.equal(list.isEmpty(), false);
  assert.equal(list.front(), baz);
  assert.equal(list.back(), foo);
  assert.deepEqual(Array.from(list), ['baz', 'foo']);

  list.remove(baz);
  assert.equal(list.isEmpty(), false);
  assert.equal(list.front(), foo);
  assert.equal(list.back(), foo);
  assert.deepEqual(Array.from(list), ['foo']);

  list.remove(foo);
  assert.equal(list.isEmpty(), true);
  assert.equal(list.front(), null);
  assert.equal(list.back(), null);
  assert.deepEqual(Array.from(list), []);
});

test('LinkedList.pushBack()', () => {
  const list = new LinkedList();

  const foo = list.pushBack('foo');
  const bar = list.pushBack('bar');
  const baz = list.pushBack('baz');

  assert.equal(foo.value, 'foo');
  assert.equal(bar.value, 'bar');
  assert.equal(baz.value, 'baz');
  assert.deepEqual(Array.from(list), ['foo', 'bar', 'baz']);

  list.remove(bar);
  assert.equal(list.isEmpty(), false);
  assert.equal(list.front(), foo);
  assert.equal(list.back(), baz);
  assert.deepEqual(Array.from(list), ['foo', 'baz']);

  list.remove(baz);
  assert.equal(list.isEmpty(), false);
  assert.equal(list.front(), foo);
  assert.equal(list.back(), foo);
  assert.deepEqual(Array.from(list), ['foo']);

  list.remove(foo);
  assert.equal(list.isEmpty(), true);
  assert.equal(list.front(), null);
  assert.equal(list.back(), null);
  assert.deepEqual(Array.from(list), []);
});

test('LinkedList.popFront()', () => {
  const list = new LinkedList();

  const foo = list.pushBack('foo');
  const bar = list.pushBack('bar');
  const baz = list.pushBack('baz');

  assert.equal(foo.value, 'foo');
  assert.equal(bar.value, 'bar');
  assert.equal(baz.value, 'baz');
  assert.deepEqual(Array.from(list), ['foo', 'bar', 'baz']);

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

test('LinkedList.popBack()', () => {
  const list = new LinkedList();

  const foo = list.pushBack('foo');
  const bar = list.pushBack('bar');
  const baz = list.pushBack('baz');

  assert.equal(foo.value, 'foo');
  assert.equal(bar.value, 'bar');
  assert.equal(baz.value, 'baz');
  assert.deepEqual(Array.from(list), ['foo', 'bar', 'baz']);

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
