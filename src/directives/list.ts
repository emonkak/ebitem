import { initBinding } from '../binding.js';
import {
  Binding,
  ChildNodePart,
  Directive,
  Effect,
  Part,
  PartType,
  Updater,
  directiveTag,
} from '../types.js';

type Selector<TItem, TResult> = (item: TItem, index: number) => TResult;

export function list<TItem>(
  items: TItem[],
): ListDirective<TItem, TItem, number>;
export function list<TItem, TValue>(
  items: TItem[],
  valueSelector: Selector<TItem, TValue>,
): ListDirective<TItem, TValue, number>;
export function list<TItem, TValue, TKey>(
  items: TItem[],
  valueSelector: Selector<TItem, TValue>,
  keySelector: Selector<TItem, TKey>,
): ListDirective<TItem, TValue, number>;
export function list<TItem, TValue, TKey>(
  items: TItem[],
  valueSelector: Selector<TItem, TValue> = (item: any, _index: any) => item,
  keySelector: Selector<TItem, TKey> = (_item: any, index: any) => index,
): ListDirective<TItem, TValue, TKey> {
  return new ListDirective(items, valueSelector, keySelector);
}

export class ListDirective<TItem, TValue, TKey> implements Directive {
  private readonly _items: TItem[];

  private readonly _valueSelector: Selector<TItem, TValue>;

  private readonly _keySelector: Selector<TItem, TKey>;

  constructor(
    items: TItem[],
    valueSelector: Selector<TItem, TValue>,
    keySelector: Selector<TItem, TKey>,
  ) {
    this._items = items;
    this._valueSelector = valueSelector;
    this._keySelector = keySelector;
  }

  get items(): TItem[] {
    return this._items;
  }

  get valueSelector(): (item: TItem, index: number) => TValue {
    return this._valueSelector;
  }

  get keySelector(): (item: TItem, index: number) => TKey {
    return this._keySelector;
  }

  [directiveTag](
    part: Part,
    updater: Updater,
  ): ListBinding<TItem, TValue, TKey> {
    if (part.type !== PartType.CHILD_NODE) {
      throw new Error('ListDirective must be used in an arbitrary child.');
    }

    return new ListBinding(part, this, updater);
  }
}

export class ListBinding<TItem, TValue, TKey>
  implements Binding<ListDirective<TItem, TValue, TKey>>
{
  private readonly _part: ChildNodePart;

  private _directive: ListDirective<TItem, TValue, TKey>;

  private _bindings: ListItemBinding<TValue>[];

  private _keys: TKey[];

  constructor(
    part: ChildNodePart,
    directive: ListDirective<TItem, TValue, TKey>,
    updater: Updater,
  ) {
    const { items, keySelector, valueSelector } = directive;
    const bindings = new Array<ListItemBinding<TValue>>(items.length);
    const keys = items.map(keySelector);
    const values = items.map(valueSelector);

    for (let i = 0, l = bindings.length; i < l; i++) {
      bindings[i] = initItemBinding(values[i]!, part, updater);
    }

    this._part = part;
    this._directive = directive;
    this._keys = keys;
    this._bindings = bindings;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._bindings[0]?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): ListDirective<TItem, TValue, TKey> {
    return this._directive;
  }

  set value(newDirective: ListDirective<TItem, TValue, TKey>) {
    this._directive = newDirective;
  }

  bind(updater: Updater): void {
    const { items, keySelector, valueSelector } = this._directive;
    const oldBindings: (ListItemBinding<TValue> | undefined)[] = this._bindings;
    const oldKeys = this._keys;
    const newBindings = new Array<ListItemBinding<TValue>>(items.length);
    const newKeys = items.map(keySelector);
    const newValues = items.map(valueSelector);

    // Head and tail pointers to old parts and new values.
    let oldHead = 0;
    let oldTail = oldBindings.length - 1;
    let newHead = 0;
    let newTail = newBindings.length - 1;

    let newKeyToIndexMap: Map<TKey, number> | undefined;
    let oldKeyToIndexMap: Map<TKey, number> | undefined;

    while (oldHead <= oldTail && newHead <= newTail) {
      if (oldBindings[oldHead] === undefined) {
        // `null` means old part at head has already been used below; skip
        oldHead++;
      } else if (oldBindings[oldTail] === undefined) {
        // `null` means old part at tail has already been used below; skip
        oldTail--;
      } else if (oldKeys[oldHead] === newKeys[newHead]) {
        // Old head matches new head; update in place
        newBindings[newHead] = updateItemBinding(
          oldBindings[oldHead]!,
          newValues[newHead]!,
          updater,
        );
        oldHead++;
        newHead++;
      } else if (oldKeys[oldTail] === newKeys[newTail]) {
        // Old tail matches new tail; update in place
        newBindings[newTail] = updateItemBinding(
          oldBindings[oldTail]!,
          newValues[newTail]!,
          updater,
        );
        oldTail--;
        newTail--;
      } else if (oldKeys[oldHead] === newKeys[newTail]) {
        // Old tail matches new head; update and move to new head.
        newBindings[newTail] = updateAndReorderItemBinding(
          oldBindings[oldHead]!,
          newValues[newTail]!,
          newBindings[newTail + 1] ?? null,
          updater,
        );
        oldHead++;
        newTail--;
      } else if (oldKeys[oldTail] === newKeys[newHead]) {
        // Old tail matches new head; update and move to new head.
        newBindings[newHead] = updateAndReorderItemBinding(
          oldBindings[oldTail]!,
          newValues[newHead]!,
          oldBindings[oldHead] ?? null,
          updater,
        );
        oldTail--;
        newHead++;
      } else {
        if (newKeyToIndexMap === undefined) {
          // Lazily generate key-to-index maps, used for removals and moves
          // below.
          newKeyToIndexMap = generateIndexMap(newKeys, newHead, newTail);
          oldKeyToIndexMap = generateIndexMap(oldKeys, oldHead, oldTail);
        }
        if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
          // Old head is no longer in new list; remove
          oldBindings[oldHead]!.unbind(updater);
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          // Old tail is no longer in new list; remove
          oldBindings[oldTail]!.unbind(updater);
          oldTail--;
        } else {
          // Any mismatches at this point are due to additions or moves; see if
          // we have an old part we can reuse and move into place.
          const oldIndex = oldKeyToIndexMap!.get(newKeys[newHead]!);
          if (oldIndex !== undefined) {
            // Reuse old part.
            newBindings[newHead] = updateAndReorderItemBinding(
              oldBindings[oldIndex]!,
              newValues[newHead]!,
              oldBindings[oldHead] ?? null,
              updater,
            );
            // This marks the old part as having been used, so that it will be
            // skipped in the first two checks above.
            oldBindings[oldIndex] = undefined;
          } else {
            // No old part for this value; create a new one and insert it.
            newBindings[newHead] = initItemBinding(
              newValues[newHead]!,
              this._part,
              updater,
            );
          }
          newHead++;
        }
      }
    }

    // Add parts for any remaining new values.
    while (newHead <= newTail) {
      // For all remaining additions, we insert before last new tail, since old
      // pointers are no longer valid.
      newBindings[newHead] = initItemBinding(
        newValues[newHead]!,
        this._part,
        updater,
      );
      newHead++;
    }

    // Remove any remaining unused old parts.
    while (oldHead <= oldTail) {
      oldBindings[oldHead]?.unbind(updater);
      oldHead++;
    }

    this._bindings = newBindings;
    this._keys = newKeys;
  }

  unbind(updater: Updater): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.unbind(updater);
    }

    this._bindings = [];
  }

  disconnect(): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.disconnect();
    }
  }
}

const ListItemFlags = {
  NONE: 0,
  MUTATING: 1 << 0,
  UNMOUNTING: 1 << 1,
  REORDERING: 1 << 2,
};

class ListItemBinding<T> implements Binding<T>, Effect {
  private readonly _listPart: ChildNodePart;

  private _itemBinding: Binding<T>;

  private _referenceBinding: ListItemBinding<T> | null = null;

  private _flags = ListItemFlags.NONE;

  constructor(
    itemBinding: Binding<T>,
    listPart: ChildNodePart,
    updater: Updater,
  ) {
    this._itemBinding = itemBinding;
    this._listPart = listPart;

    this._requestMutation(updater);
  }

  get part(): Part {
    return this._itemBinding.part;
  }

  get startNode(): ChildNode {
    return this._itemBinding.startNode;
  }

  get endNode(): ChildNode {
    return this._itemBinding.endNode;
  }

  get value(): T {
    return this._itemBinding.value;
  }

  set value(newValue: T) {
    this._itemBinding.value = newValue;
  }

  reorder(
    newReferenceBinding: ListItemBinding<T> | null,
    updater: Updater,
  ): void {
    this._referenceBinding = newReferenceBinding;

    this._requestMutation(updater);

    this._flags |= ListItemFlags.REORDERING;
  }

  bind(updater: Updater): void {
    this._itemBinding.bind(updater);

    this._flags &= ~ListItemFlags.UNMOUNTING;
  }

  unbind(updater: Updater): void {
    this._itemBinding.unbind(updater);

    this._requestMutation(updater);

    this._flags |= ListItemFlags.UNMOUNTING;
  }

  disconnect(): void {
    this._itemBinding?.disconnect();
  }

  commit(): void {
    if (this._flags & ListItemFlags.UNMOUNTING) {
      this._itemBinding.part.node.remove();
    } else if (this._flags & ListItemFlags.REORDERING) {
      const referenceNode =
        this._referenceBinding?.startNode ?? this._listPart.node;
      const { startNode, endNode } = this._itemBinding;

      // elements must be collected first to avoid infinite loop.
      const nodes = [];
      let currentNode: Node | null = startNode;

      do {
        const nextNode: Node | null = currentNode.nextSibling;
        nodes.push(currentNode);
        if (currentNode === endNode) {
          break;
        }
        currentNode = nextNode;
      } while (currentNode !== null);

      referenceNode.before(...nodes);
    } else {
      this._listPart.node.before(this._itemBinding.part.node);
    }

    this._flags &= ~(
      ListItemFlags.MUTATING |
      ListItemFlags.UNMOUNTING |
      ListItemFlags.REORDERING
    );
  }

  private _requestMutation(updater: Updater): void {
    if (!(this._flags & ListItemFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= ListItemFlags.MUTATING;
    }
  }
}

function initItemBinding<T>(
  value: T,
  listPart: ChildNodePart,
  updater: Updater,
): ListItemBinding<T> {
  const itemPart = {
    type: PartType.CHILD_NODE,
    node: document.createComment(''),
  } as const;
  const itemBinding = initBinding(itemPart, value, updater);
  return new ListItemBinding<T>(itemBinding, listPart, updater);
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

function updateAndReorderItemBinding<T>(
  binding: ListItemBinding<T>,
  newValue: T,
  newReferenceBinding: ListItemBinding<T> | null,
  updater: Updater,
): ListItemBinding<T> {
  binding.value = newValue;
  binding.reorder(newReferenceBinding, updater);
  binding.bind(updater);
  return binding;
}

function updateItemBinding<T>(
  binding: ListItemBinding<T>,
  newValue: T,
  updater: Updater,
): ListItemBinding<T> {
  binding.value = newValue;
  binding.bind(updater);
  return binding;
}
