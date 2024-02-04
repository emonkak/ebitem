import { strict as assert } from 'node:assert';
import test from 'node:test';

import { SlotMap } from '../src/slotMap.js';

test('SlotMap.insert()', () => {
  const arena = new SlotMap();

  const foo = arena.insert('foo');
  const bar = arena.insert('bar');
  const baz = arena.insert('baz');

  assert.equal(arena.get(foo), 'foo');
  assert.equal(arena.get(bar), 'bar');
  assert.equal(arena.get(baz), 'baz');

  assert.equal(arena.remove(bar), 'bar');

  assert.equal(arena.get(foo), 'foo');
  assert.equal(arena.get(bar), undefined);
  assert.equal(arena.get(baz), 'baz');

  assert.equal(arena.remove(baz), 'baz');

  assert.equal(arena.get(foo), 'foo');
  assert.equal(arena.get(bar), undefined);
  assert.equal(arena.get(baz), undefined);

  const qux = arena.insert('qux');

  assert.equal(arena.get(foo), 'foo');
  assert.equal(arena.get(bar), undefined);
  assert.equal(arena.get(baz), undefined);
  assert.equal(arena.get(qux), 'qux');

  assert.equal(arena.remove(qux), 'qux');

  assert.equal(arena.get(foo), 'foo');
  assert.equal(arena.get(bar), undefined);
  assert.equal(arena.get(baz), undefined);
  assert.equal(arena.get(qux), undefined);

  assert.equal(arena.remove(foo), 'foo');

  assert.equal(arena.get(foo), undefined);
  assert.equal(arena.get(bar), undefined);
  assert.equal(arena.get(baz), undefined);
  assert.equal(arena.get(qux), undefined);

  const quux = arena.insert('quux');

  assert.equal(arena.get(foo), undefined);
  assert.equal(arena.get(bar), undefined);
  assert.equal(arena.get(baz), undefined);
  assert.equal(arena.get(qux), undefined);
  assert.equal(arena.get(quux), 'quux');
});
