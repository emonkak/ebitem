import { Directive, directiveTag } from '../directive.js';
import { List } from '../list.js';
import type { Part } from '../part.js';
import { ChildPart } from '../part/child.js';
import type { Updater } from '../updater.js';

export function list<TItem>(
  items: TItem[],
): ListDirective<TItem, TItem, number>;
export function list<TItem, TValue>(
  items: TItem[],
  valueSelector: (item: TItem, index: number) => TValue,
): ListDirective<TItem, TValue, number>;
export function list<TItem, TValue, TKey>(
  items: TItem[],
  valueSelector: (item: TItem, index: number) => TValue,
  keySelector: (item: TItem, index: number) => TKey,
): ListDirective<TItem, TValue, number>;
export function list<TItem, TValue, TKey>(
  items: TItem[],
  valueSelector: (item: TItem, index: number) => TValue = (
    item: any,
    _index: any,
  ) => item,
  keySelector: (item: TItem, index: number) => TKey = (
    _item: any,
    index: any,
  ) => index,
): ListDirective<TItem, TValue, TKey> {
  return new ListDirective(items, valueSelector, keySelector);
}

export class ListDirective<TItem, TValue, TKey> implements Directive {
  private readonly _items: TItem[];

  private readonly _valueSelector: (item: TItem, index: number) => TValue;

  private readonly _keySelector: (item: TItem, index: number) => TKey;

  constructor(
    items: TItem[],
    valueSelector: (item: TItem, index: number) => TValue,
    keySelector: (item: TItem, index: number) => TKey,
  ) {
    this._items = items;
    this._valueSelector = valueSelector;
    this._keySelector = keySelector;
  }

  [directiveTag](_context: unknown, part: Part, updater: Updater): void {
    if (!(part instanceof ChildPart)) {
      throw new Error('List directive must be used in an arbitrary child.');
    }

    const value = part.value;

    if (value instanceof List) {
      value.update(
        this._items,
        this._valueSelector,
        this._keySelector,
        updater,
      );
    } else {
      const list = new List(
        this._items,
        this._valueSelector,
        this._keySelector,
        part,
        updater,
      );
      part.value = list;
    }

    updater.enqueueMutationEffect(part);
    updater.requestUpdate();
  }
}
