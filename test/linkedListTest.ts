import { strict as assert } from 'node:assert';
import test from 'node:test';

import { LinkedList } from '../src/linkedList.js';

test('SlotMap.pushFront()', () => {
  const list = new LinkedList();

  const foo = list.pushFront('foo');
  const bar = list.pushFront('bar');
  const baz = list.pushFront('baz');

  assert.equal(foo.value, 'foo');
  assert.equal(bar.value, 'bar');
  assert.equal(baz.value, 'baz');
  assert.equal(list.front(), baz);
  assert.equal(list.back(), foo);
  assert.deepEqual(Array.from(list), ['baz', 'bar', 'foo']);

  list.remove(bar);
  assert.equal(list.front(), baz);
  assert.equal(list.back(), foo);
  assert.deepEqual(Array.from(list), ['baz', 'foo']);

  list.remove(baz);
  assert.equal(list.front(), foo);
  assert.equal(list.back(), foo);
  assert.deepEqual(Array.from(list), ['foo']);

  list.remove(foo);
  assert.equal(list.front(), null);
  assert.equal(list.back(), null);
  assert.deepEqual(Array.from(list), []);
});

test('SlotMap.pushBack()', () => {
  const list = new LinkedList();

  const foo = list.pushBack('foo');
  const bar = list.pushBack('bar');
  const baz = list.pushBack('baz');

  assert.equal(foo.value, 'foo');
  assert.equal(bar.value, 'bar');
  assert.equal(baz.value, 'baz');
  assert.deepEqual(Array.from(list), ['foo', 'bar', 'baz']);

  list.remove(bar);
  assert.equal(list.front(), foo);
  assert.equal(list.back(), baz);
  assert.deepEqual(Array.from(list), ['foo', 'baz']);

  list.remove(baz);
  assert.equal(list.front(), foo);
  assert.equal(list.back(), foo);
  assert.deepEqual(Array.from(list), ['foo']);

  list.remove(foo);
  assert.equal(list.front(), null);
  assert.equal(list.back(), null);
  assert.deepEqual(Array.from(list), []);
});
