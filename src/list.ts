import {
  Part,
  PartChild,
  insertPart,
  mountPart,
  removePart,
  updatePart,
} from './part.js';
import { ChildPart } from './part/child.js';
import type { Effect, Updater } from './updater.js';

export class List<TItem, TValue, TKey> extends PartChild {
  private _memoizedParts: ItemPart[] = [];

  private _memoizedValues: TValue[] = [];

  private _memoizedKeys: TKey[] = [];

  private _containerPart: ChildPart;

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
    this._memoizedParts = parts;
  }

  get startNode(): ChildNode | null {
    const parts = this._memoizedParts;
    return parts.length > 0 ? parts[0]!.startNode : null;
  }

  get endNode(): ChildNode | null {
    const parts = this._memoizedParts;
    return parts.length > 0 ? parts[parts.length - 1]!.endNode : null;
  }

  update(
    newItems: TItem[],
    valueSelector: (item: TItem, index: number) => TValue,
    keySelector: (item: TItem, index: number) => TKey,
    updater: Updater,
  ): void {
    const oldParts: (ItemPart | undefined)[] = this._memoizedParts;
    const oldValues = this._memoizedValues;
    const oldKeys = this._memoizedKeys;
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
        const oldPart = oldParts[oldHead]!;
        updatePart(oldPart, oldValues[oldHead], newValues[newHead], updater);
        newParts[newHead] = oldPart;
        oldHead++;
        newHead++;
      } else if (oldKeys[oldTail] === newKeys[newTail]) {
        // Old tail matches new tail; update in place
        const oldPart = oldParts[oldTail]!;
        updatePart(oldPart, oldValues[oldTail], newValues[newTail], updater);
        newParts[newTail] = oldPart;
        oldTail--;
        newTail--;
      } else if (oldKeys[oldHead] === newKeys[newTail]) {
        // Old tail matches new head; update and move to new head
        const oldPart = oldParts[oldHead]!;
        updater.enqueueMutationEffect(
          new ReorderItemPart(oldPart, newParts[newTail + 1] ?? null),
        );
        updatePart(oldPart, oldValues[oldHead], newValues[newTail], updater);
        newParts[newTail] = oldPart;
        oldHead++;
        newTail--;
      } else if (oldKeys[oldTail] === newKeys[newHead]) {
        // Old tail matches new head; update and move to new head
        const oldPart = oldParts[oldTail]!;
        updater.enqueueMutationEffect(
          new ReorderItemPart(oldPart, oldParts[oldHead] ?? null),
        );
        updatePart(oldPart, oldValues[oldTail], newValues[newHead], updater);
        newParts[newHead] = oldPart;
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
          const oldPart = oldParts[oldHead]!;
          removePart(oldPart, updater);
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          // Old tail is no longer in new list; remove
          const oldPart = oldParts[oldTail]!;
          removePart(oldPart, updater);
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
            insertPart(part, newValues[newHead], updater);
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
      insertPart(newPart, newValues[newHead], updater);
      newParts[newHead] = newPart;
      newHead++;
    }

    // Remove any remaining unused old parts
    while (oldHead <= oldTail) {
      const oldPart = oldParts[oldHead];
      if (oldPart) {
        removePart(oldPart, updater);
      }
      oldHead++;
    }

    this._memoizedValues = newValues;
    this._memoizedKeys = newKeys;
  }

  mount(_part: Part, _updater: Updater): void {}

  unmount(_part: Part, updater: Updater): void {
    for (let i = 0, l = this._memoizedParts.length; i < l; i++) {
      this._memoizedParts[i]!.disconnect(updater);
    }
  }

  commit(updater: Updater): void {
    for (let i = 0, l = this._memoizedParts.length; i < l; i++) {
      this._memoizedParts[i]!.commit(updater);
    }
  }
}

export class ItemPart extends ChildPart implements Part {
  private readonly _containerPart: ChildPart;

  constructor(markerNode: Comment, containerPart: ChildPart) {
    super(markerNode);
    this._containerPart = containerPart;
  }

  override commit(updater: Updater): void {
    if (!this._markerNode.isConnected) {
      const reference = this._containerPart.endNode;
      reference.parentNode?.insertBefore(this._markerNode, reference);
    }

    super.commit(updater);
  }

  override disconnect(updater: Updater): void {
    super.disconnect(updater);

    this._markerNode.remove();
  }

  reorder(referencePart: ChildPart | null): void {
    const reference = referencePart
      ? referencePart.startNode
      : this._containerPart.endNode;

    reference.parentNode?.insertBefore(this._markerNode, reference);
  }
}

class ReorderItemPart implements Effect {
  private readonly _part: ItemPart;

  private readonly _referencePart: ChildPart | null;

  constructor(part: ItemPart, referencePart: ChildPart | null) {
    this._part = part;
    this._referencePart = referencePart;
  }

  commit(_updater: Updater): void {
    this._part.reorder(this._referencePart);
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
