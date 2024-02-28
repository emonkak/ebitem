import { Directive, directiveSymbol } from '../directive.js';
import { DisconnectPart, Part, mountPart, updatePart } from '../part.js';
import { ChildPart, ChildValue } from '../part/child.js';
import type { Effect, Updater } from '../updater.js';

export function list<TItem>(items: TItem[]): List<TItem, TItem, number>;
export function list<TItem, TValue>(
  items: TItem[],
  valueSelector: (item: TItem, index: number) => TValue,
): List<TItem, TValue, number>;
export function list<TItem, TValue, TKey>(
  items: TItem[],
  valueSelector: (item: TItem, index: number) => TValue,
  keySelector: (item: TItem, index: number) => TKey,
): List<TItem, TValue, number>;
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
): List<TItem, TValue, TKey> {
  return new List(items, valueSelector, keySelector);
}

export class List<TItem, TValue, TKey> implements Directive {
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

  [directiveSymbol](part: Part, updater: Updater): void {
    if (!(part instanceof ChildPart)) {
      throw new Error('"List" directive must be used in an arbitrary child.');
    }

    const value = part.value;

    if (value instanceof ListChild) {
      value.update(
        this._items,
        this._valueSelector,
        this._keySelector,
        updater,
      );
    } else {
      const list = new ListChild(
        this._items,
        this._valueSelector,
        this._keySelector,
        part,
        updater,
      );
      part.setValue(list, updater);
    }

    updater.enqueueMutationEffect(part);
  }
}

export class ListChild<TItem, TValue, TKey> extends ChildValue {
  private _commitedParts: ItemPart[] = [];

  private _commitedValues: TValue[] = [];

  private _commitedKeys: TKey[] = [];

  private _containerPart: ChildPart;

  private _pendingParts: ItemPart[];

  private _pendingValues: TValue[];

  private _pendingKeys: TKey[];

  constructor(
    items: TItem[],
    valueSelector: (item: TItem, index: number) => TValue,
    keySelector: (item: TItem, index: number) => TKey,
    containerPart: ChildPart,
    updater: Updater,
  ) {
    super();

    const parts = new Array(items.length);
    const values = new Array(items.length);
    const keys = new Array(items.length);

    for (let i = 0, l = items.length; i < l; i++) {
      const item = items[i]!;
      const part = new ItemPart(document.createComment(''), containerPart);
      const value = valueSelector(item, i);
      const key = keySelector(item, i);
      mountPart(part, value, updater);
      parts[i] = part;
      values[i] = value;
      keys[i] = key;
    }

    this._containerPart = containerPart;
    this._pendingParts = parts;
    this._pendingValues = values;
    this._pendingKeys = keys;
  }

  get startNode(): ChildNode | null {
    const parts = this._commitedParts;
    return parts.length > 0 ? parts[0]!.startNode : null;
  }

  get endNode(): ChildNode | null {
    const parts = this._commitedParts;
    return parts.length > 0 ? parts[parts.length - 1]!.endNode : null;
  }

  onMount(_part: Part, _updater: Updater): void {}

  onUnmount(_part: Part, updater: Updater): void {
    for (let i = 0, l = this._commitedParts.length; i < l; i++) {
      this._commitedParts[i]!.disconnect(updater);
    }
  }

  onUpdate(_part: ChildPart, _updater: Updater): void {
    this._commitedParts = this._pendingParts;
    this._commitedValues = this._pendingValues;
    this._commitedKeys = this._pendingKeys;
  }

  update(
    newItems: TItem[],
    valueSelector: (item: TItem, index: number) => TValue,
    keySelector: (item: TItem, index: number) => TKey,
    updater: Updater,
  ): void {
    const oldParts: (ItemPart | undefined)[] = this._commitedParts;
    const oldValues = this._commitedValues;
    const oldKeys = this._commitedKeys;
    const newParts = new Array(newItems.length);
    const newValues = newItems.map(valueSelector);
    const newKeys = newItems.map(keySelector);

    // Head and tail pointers to old parts and new values
    let oldHead = 0;
    let oldTail = oldParts.length - 1;
    let newHead = 0;
    let newTail = newValues.length - 1;

    let newKeyToIndexMap;
    let oldKeyToIndexMap;

    while (oldHead <= oldTail && newHead <= newTail) {
      if (oldParts[oldHead] === undefined) {
        // `null` means old part at head has already been used
        // below; skip
        oldHead++;
      } else if (oldParts[oldTail] === undefined) {
        // `null` means old part at tail has already been used
        // below; skip
        oldTail--;
      } else if (oldKeys[oldHead] === newKeys[newHead]) {
        // Old head matches new head; update in place
        const part = oldParts[oldHead]!;
        updatePart(part, oldValues[oldHead], newValues[newHead], updater);
        newParts[newHead] = part;
        oldHead++;
        newHead++;
      } else if (oldKeys[oldTail] === newKeys[newTail]) {
        // Old tail matches new tail; update in place
        const part = oldParts[oldTail]!;
        updatePart(part, oldValues[oldTail], newValues[newTail], updater);
        newParts[newTail] = part;
        oldTail--;
        newTail--;
      } else if (oldKeys[oldHead] === newKeys[newTail]) {
        // Old tail matches new head; update and move to new head
        const part = oldParts[oldHead]!;
        updater.enqueueMutationEffect(
          new ReorderItemPart(part, newParts[newTail + 1] ?? null),
        );
        updatePart(part, oldValues[oldHead], newValues[newTail], updater);
        newParts[newTail] = part;
        oldHead++;
        newTail--;
      } else if (oldKeys[oldTail] === newKeys[newHead]) {
        // Old tail matches new head; update and move to new head
        const part = oldParts[oldTail]!;
        updater.enqueueMutationEffect(
          new ReorderItemPart(part, oldParts[oldHead] ?? null),
        );
        updatePart(part, oldValues[oldTail], newValues[newHead], updater);
        newParts[newHead] = part;
        oldTail--;
        newHead++;
      } else {
        if (newKeyToIndexMap === undefined) {
          // Lazily generate key-to-index maps, used for removals &
          // moves below
          newKeyToIndexMap = generateIndexMap(newKeys, newHead, newTail);
          oldKeyToIndexMap = generateIndexMap(oldKeys, oldHead, oldTail);
        }
        if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
          // Old head is no longer in new list; remove
          const part = oldParts[oldHead]!;
          updater.enqueueMutationEffect(new DisconnectPart(part));
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          // Old tail is no longer in new list; remove
          const part = oldParts[oldTail]!;
          updater.enqueueMutationEffect(new DisconnectPart(part));
          oldTail--;
        } else {
          // Any mismatches at this point are due to additions or
          // moves; see if we have an old part we can reuse and move
          // into place
          const oldIndex = oldKeyToIndexMap!.get(newKeys[newHead]!);
          if (oldIndex !== undefined) {
            // Reuse old part
            const oldPart = oldParts[oldIndex]!;
            updater.enqueueMutationEffect(
              new ReorderItemPart(oldPart, oldParts[oldHead] ?? null),
            );
            updatePart(
              oldPart,
              oldValues[oldHead],
              newValues[newHead],
              updater,
            );
            newParts[newHead] = oldPart;
            // This marks the old part as having been used, so that
            // it will be skipped in the first two checks above
            oldParts[oldIndex] = undefined;
          } else {
            // No old part for this value; create a new one and
            // insert it
            const part = new ItemPart(
              document.createComment(''),
              this._containerPart,
            );
            mountPart(part, newValues[newHead], updater);
            newParts[newHead] = part;
          }
          newHead++;
        }
      }
    }

    // Add parts for any remaining new values
    while (newHead <= newTail) {
      // For all remaining additions, we insert before last new
      // tail, since old pointers are no longer valid
      const newPart = new ItemPart(
        document.createComment(''),
        this._containerPart,
      );
      mountPart(newPart, newValues[newHead], updater);
      newParts[newHead] = newPart;
      newHead++;
    }

    // Remove any remaining unused old parts
    while (oldHead <= oldTail) {
      const oldPart = oldParts[oldHead];
      if (oldPart) {
        updater.enqueueMutationEffect(new DisconnectPart(oldPart));
      }
      oldHead++;
    }

    this._pendingParts = newParts;
    this._pendingValues = newValues;
    this._pendingKeys = newKeys;
  }
}

export class ItemPart extends ChildPart implements Part {
  private readonly _containerPart: ChildPart;

  constructor(node: ChildNode, containerPart: ChildPart) {
    super(node);
    this._containerPart = containerPart;
  }

  override commit(updater: Updater): void {
    if (!this.node.isConnected) {
      const reference = this._containerPart.endNode;
      reference.parentNode!.insertBefore(this._node, reference);
    }

    super.commit(updater);
  }

  override disconnect(updater: Updater): void {
    this._node.remove();
    super.disconnect(updater);
  }

  reorder(referencePart: ChildPart | null, updater: Updater): void {
    const reference = referencePart
      ? referencePart.startNode
      : this._containerPart.endNode;

    reference.parentNode!.insertBefore(this._node, reference);

    this._committedValue?.onMount(this, updater);
  }
}

class ReorderItemPart implements Effect {
  private readonly _part: ItemPart;

  private readonly _referencePart: ChildPart | null;

  constructor(part: ItemPart, referencePart: ChildPart | null) {
    this._part = part;
    this._referencePart = referencePart;
  }

  commit(updater: Updater): void {
    this._part.reorder(this._referencePart, updater);
  }
}

function generateIndexMap<T>(
  elements: T[],
  start: number,
  end: number,
): Map<T, number> {
  const map = new Map();
  for (let i = start; i <= end; i++) {
    map.set(elements[i], i);
  }
  return map;
}
