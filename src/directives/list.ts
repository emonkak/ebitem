import { initializeBinding } from '../binding.js';
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
    if (part.type !== PartType.ChildNode) {
      throw new Error('ListDirective must be used in an arbitrary child.');
    }

    return new ListBinding(this, part, updater);
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
    directive: ListDirective<TItem, TValue, TKey>,
    part: ChildNodePart,
    updater: Updater,
  ) {
    const { items, keySelector, valueSelector } = directive;
    const bindings = new Array<ListItemBinding<TValue>>(items.length);
    const keys = items.map(keySelector);
    const values = items.map(valueSelector);

    for (let i = 0, l = bindings.length; i < l; i++) {
      bindings[i] = new ListItemBinding(values[i]!, part, updater);
    }

    this._directive = directive;
    this._keys = keys;
    this._bindings = bindings;
    this._part = part;
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
        const binding = (newBindings[newHead] = oldBindings[oldHead]!);
        binding.value = newValues[newHead]!;
        binding.bind(updater);
        oldHead++;
        newHead++;
      } else if (oldKeys[oldTail] === newKeys[newTail]) {
        // Old tail matches new tail; update in place
        const binding = (newBindings[newTail] = oldBindings[oldTail]!);
        binding.value = newValues[newTail]!;
        binding.bind(updater);
        oldTail--;
        newTail--;
      } else if (oldKeys[oldHead] === newKeys[newTail]) {
        // Old tail matches new head; update and move to new head.
        const binding = (newBindings[newTail] = oldBindings[oldHead]!);
        binding.value = newValues[newTail]!;
        binding.reorder(newBindings[newTail + 1] ?? null, updater);
        binding.bind(updater);
        oldHead++;
        newTail--;
      } else if (oldKeys[oldTail] === newKeys[newHead]) {
        // Old tail matches new head; update and move to new head.
        const binding = (newBindings[newHead] = oldBindings[oldTail]!);
        binding.value = newValues[newHead]!;
        binding.reorder(oldBindings[oldHead] ?? null, updater);
        binding.bind(updater);
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
            const binding = (newBindings[newHead] = oldBindings[oldIndex]!);
            binding.value = newValues[newHead]!;
            binding.reorder(oldBindings[oldHead] ?? null, updater);
            binding.bind(updater);
            // This marks the old part as having been used, so that it will be
            // skipped in the first two checks above.
            oldBindings[oldIndex] = undefined;
          } else {
            // No old part for this value; create a new one and insert it.
            newBindings[newHead] = new ListItemBinding(
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
      newBindings[newHead] = new ListItemBinding(
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

  constructor(value: T, listPart: ChildNodePart, updater: Updater) {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;

    this._itemBinding = initializeBinding(value, part, updater);
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
      const { startNode, endNode } = this._itemBinding;
      const referenceNode =
        this._referenceBinding?.startNode ?? this._listPart.node;
      moveNodes(startNode, endNode, referenceNode);
    } else {
      const referenceNode = this._listPart.node;
      referenceNode.before(this._itemBinding.part.node);
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

function moveNodes(startNode: Node, endNode: Node, referenceNode: ChildNode) {
  // Elements must be collected first to avoid infinite loop.
  const targetNodes: Node[] = [];

  let currentNode: Node | null = startNode;

  do {
    targetNodes.push(currentNode);
  } while (
    currentNode !== endNode &&
    (currentNode = currentNode.nextSibling) !== null
  );

  referenceNode.before(...targetNodes);
}
