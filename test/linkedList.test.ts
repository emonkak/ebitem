import { describe, expect, it } from 'vitest';

import { LinkedList } from '../src/linkedList.js';

describe('LinkedList', () => {
  it('should create an empty list', () => {
    const list = new LinkedList();

    expect(list.isEmpty()).toBe(true);
    expect(list.front()).toBe(null);
    expect(list.back()).toBe(null);
    expect(Array.from(list)).toEqual([]);
  });

  describe('.pushFront()', () => {
    it('should prepend a single value to the list', () => {
      const list = new LinkedList();
      const foo = list.pushFront('foo');

      expect(foo.value).toBe('foo');
      expect(list.contains(foo)).toBe(true);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(foo);
      expect(list.back()).toBe(foo);
      expect(Array.from(list)).toEqual(['foo']);
    });

    it('should prepend values to the list', () => {
      const list = new LinkedList();
      const foo = list.pushFront('foo');
      const bar = list.pushFront('bar');
      const baz = list.pushFront('baz');

      expect(foo.value).toBe('foo');
      expect(bar.value).toBe('bar');
      expect(baz.value).toBe('baz');
      expect(list.contains(foo)).toBe(true);
      expect(list.contains(bar)).toBe(true);
      expect(list.contains(baz)).toBe(true);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(baz);
      expect(list.back()).toBe(foo);
      expect(Array.from(list)).toEqual(['baz', 'bar', 'foo']);
    });
  });

  describe('.pushBack()', () => {
    it('should append a single value to the list', () => {
      const list = new LinkedList();
      const foo = list.pushBack('foo');

      expect(foo.value).toBe('foo');
      expect(list.contains(foo)).toBe(true);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(foo);
      expect(list.back()).toBe(foo);
      expect(Array.from(list)).toEqual(['foo']);
    });

    it('should append values to the list', () => {
      const list = new LinkedList();
      const foo = list.pushBack('foo');
      const bar = list.pushBack('bar');
      const baz = list.pushBack('baz');

      expect(foo.value).toBe('foo');
      expect(bar.value).toBe('bar');
      expect(baz.value).toBe('baz');
      expect(list.contains(foo)).toBe(true);
      expect(list.contains(bar)).toBe(true);
      expect(list.contains(baz)).toBe(true);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(foo);
      expect(list.back()).toBe(baz);
      expect(Array.from(list)).toEqual(['foo', 'bar', 'baz']);
    });
  });

  describe('.popFront()', () => {
    it('should remove values from the head', () => {
      const list = new LinkedList();
      const foo = list.pushBack('foo');
      const bar = list.pushBack('bar');
      const baz = list.pushBack('baz');

      expect(list.popFront()).toBe(foo);
      expect(list.contains(foo)).toBe(false);
      expect(list.contains(bar)).toBe(true);
      expect(list.contains(baz)).toBe(true);
      expect(foo.next).toBe(null);
      expect(foo.prev).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(bar);
      expect(list.back()).toBe(baz);
      expect(Array.from(list)).toEqual(['bar', 'baz']);

      expect(list.popFront()).toBe(bar);
      expect(list.contains(foo)).toBe(false);
      expect(list.contains(bar)).toBe(false);
      expect(list.contains(baz)).toBe(true);
      expect(bar.next).toBe(null);
      expect(bar.prev).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(baz);
      expect(list.back()).toBe(baz);
      expect(Array.from(list)).toEqual(['baz']);

      expect(list.popFront()).toBe(baz);
      expect(list.contains(foo)).toBe(false);
      expect(list.contains(bar)).toBe(false);
      expect(list.contains(baz)).toBe(false);
      expect(baz.next).toBe(null);
      expect(baz.prev).toBe(null);
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toEqual([]);
    });

    it('should remove head values', () => {
      const list = new LinkedList();
      const foo = list.pushBack('foo');
      const bar = list.pushBack('bar');
      const baz = list.pushBack('baz');

      expect(list.popFront()).toBe(foo);
      expect(list.popFront()).toBe(bar);
      expect(list.popFront()).toBe(baz);

      expect(list.contains(foo)).toBe(false);
      expect(list.contains(bar)).toBe(false);
      expect(list.contains(baz)).toBe(false);
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toEqual([]);
    });
  });

  describe('.popBack()', () => {
    it('should remove values from the tail', () => {
      const list = new LinkedList();
      const foo = list.pushBack('foo');
      const bar = list.pushBack('bar');
      const baz = list.pushBack('baz');

      expect(list.popBack()).toBe(baz);
      expect(list.contains(foo)).toBe(true);
      expect(list.contains(bar)).toBe(true);
      expect(list.contains(baz)).toBe(false);
      expect(baz.next).toBe(null);
      expect(baz.prev).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(foo);
      expect(list.back()).toBe(bar);
      expect(Array.from(list)).toEqual(['foo', 'bar']);

      expect(list.popBack()).toBe(bar);
      expect(list.contains(foo)).toBe(true);
      expect(list.contains(bar)).toBe(false);
      expect(list.contains(baz)).toBe(false);
      expect(bar.next).toBe(null);
      expect(bar.prev).toBe(null);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(foo);
      expect(list.back()).toBe(foo);
      expect(Array.from(list)).toEqual(['foo']);

      expect(list.popBack()).toBe(foo);
      expect(list.contains(foo)).toBe(false);
      expect(list.contains(bar)).toBe(false);
      expect(list.contains(baz)).toBe(false);
      expect(foo.next).toBe(null);
      expect(foo.prev).toBe(null);
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toEqual([]);
    });

    it('should remove tail values', () => {
      const list = new LinkedList();
      const foo = list.pushBack('foo');
      const bar = list.pushBack('bar');
      const baz = list.pushBack('baz');

      expect(list.popBack()).toBe(baz);
      expect(list.popBack()).toBe(bar);
      expect(list.popBack()).toBe(foo);

      expect(list.contains(foo)).toBe(false);
      expect(list.contains(bar)).toBe(false);
      expect(list.contains(baz)).toBe(false);
      expect(list.isEmpty()).toBe(true);
      expect(list.front()).toBe(null);
      expect(list.back()).toBe(null);
      expect(Array.from(list)).toEqual([]);
    });
  });

  describe('.remove()', () => {
    it('should remove a value', () => {
      const list = new LinkedList();
      const foo = list.pushBack('foo');
      const bar = list.pushBack('bar');
      const baz = list.pushBack('baz');

      list.remove(bar);

      expect(bar.next).toBe(null);
      expect(bar.prev).toBe(null);
      expect(list.contains(foo)).toBe(true);
      expect(list.contains(bar)).toBe(false);
      expect(list.contains(baz)).toBe(true);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(foo);
      expect(list.back()).toBe(baz);
      expect(Array.from(list)).toEqual(['foo', 'baz']);
    });

    it('should remove the head value', () => {
      const list = new LinkedList();
      const foo = list.pushBack('foo');
      const bar = list.pushBack('bar');
      const baz = list.pushBack('baz');

      list.remove(foo);

      expect(foo.next).toBe(null);
      expect(foo.prev).toBe(null);
      expect(list.contains(foo)).toBe(false);
      expect(list.contains(bar)).toBe(true);
      expect(list.contains(baz)).toBe(true);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(bar);
      expect(list.back()).toBe(baz);
      expect(Array.from(list)).toEqual(['bar', 'baz']);
    });

    it('should remove the tail value', () => {
      const list = new LinkedList();
      const foo = list.pushBack('foo');
      const bar = list.pushBack('bar');
      const baz = list.pushBack('baz');

      list.remove(baz);

      expect(baz.next).toBe(null);
      expect(baz.prev).toBe(null);
      expect(list.contains(foo)).toBe(true);
      expect(list.contains(bar)).toBe(true);
      expect(list.contains(baz)).toBe(false);
      expect(list.isEmpty()).toBe(false);
      expect(list.front()).toBe(foo);
      expect(list.back()).toBe(bar);
      expect(Array.from(list)).toEqual(['foo', 'bar']);
    });

    it('should not remove a value not contained in the list', () => {
      const list = new LinkedList();

      expect(() =>
        list.remove({ prev: null, next: null, value: 'foo' }),
      ).toThrow('The node is not contained in this list.');
    });
  });
});
