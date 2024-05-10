import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  PartType,
  createBinding,
  directiveTag,
  updateBinding,
} from '../binding.js';
import type { Effect, Updater } from '../updater.js';

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
      throw new Error('ListDirective must be used in ChildNodePart.');
    }

    const binding = new ListBinding(this, part);

    binding.bind(updater);

    return binding;
  }
}

export class ListBinding<TItem, TValue, TKey>
  implements Binding<ListDirective<TItem, TValue, TKey>>
{
  private readonly _part: ChildNodePart;

  private _value: ListDirective<TItem, TValue, TKey>;

  private _bindings: Binding<TValue>[] = [];

  private _keys: TKey[] = [];

  constructor(value: ListDirective<TItem, TValue, TKey>, part: ChildNodePart) {
    this._value = value;
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
    return this._value;
  }

  set value(newValue: ListDirective<TItem, TValue, TKey>) {
    this._value = newValue;
  }

  bind(updater: Updater): void {
    if (this._bindings.length > 0) {
      this._reconcileItems(updater);
    } else {
      this._initializeItems(updater);
    }
  }

  unbind(updater: Updater): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      unmountItem(this._bindings[i]!, updater);
    }

    this._bindings = [];
  }

  disconnect(): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.disconnect();
    }
  }

  private _initializeItems(updater: Updater): void {
    const { items, keySelector, valueSelector } = this._value;
    const bindings = new Array<Binding<TValue>>(items.length);
    const keys = items.map(keySelector);
    const values = items.map(valueSelector);

    for (let i = 0, l = bindings.length; i < l; i++) {
      bindings[i] = mountItem(values[i]!, this._part, updater);
    }

    this._bindings = bindings;
    this._keys = keys;
  }

  private _reconcileItems(updater: Updater): void {
    const { items, keySelector, valueSelector } = this._value;
    const oldBindings: (Binding<TValue> | undefined)[] = this._bindings;
    const oldKeys = this._keys;
    const newBindings = new Array<Binding<TValue>>(items.length);
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
        updateBinding(binding, newValues[newHead]!, updater);
        oldHead++;
        newHead++;
      } else if (oldKeys[oldTail] === newKeys[newTail]) {
        // Old tail matches new tail; update in place
        const binding = (newBindings[newTail] = oldBindings[oldTail]!);
        updateBinding(binding, newValues[newTail]!, updater);
        oldTail--;
        newTail--;
      } else if (oldKeys[oldHead] === newKeys[newTail]) {
        // Old tail matches new head; update and move to new head.
        const binding = (newBindings[newTail] = oldBindings[oldHead]!);
        updateBinding(binding, newValues[newTail]!, updater);
        reorderItem(
          binding,
          newBindings[newTail + 1] ?? null,
          this._part,
          updater,
        );
        oldHead++;
        newTail--;
      } else if (oldKeys[oldTail] === newKeys[newHead]) {
        // Old tail matches new head; update and move to new head.
        const binding = (newBindings[newHead] = oldBindings[oldTail]!);
        updateBinding(binding, newValues[newHead]!, updater);
        reorderItem(binding, oldBindings[oldHead] ?? null, this._part, updater);
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
          unmountItem(oldBindings[oldHead]!, updater);
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          // Old tail is no longer in new list; remove
          unmountItem(oldBindings[oldTail]!, updater);
          oldTail--;
        } else {
          // Any mismatches at this point are due to additions or moves; see if
          // we have an old part we can reuse and move into place.
          const oldIndex = oldKeyToIndexMap!.get(newKeys[newHead]!);
          if (oldIndex !== undefined) {
            // Reuse old part.
            const binding = (newBindings[newHead] = oldBindings[oldIndex]!);
            updateBinding(binding, newValues[newHead]!, updater);
            reorderItem(
              binding,
              oldBindings[oldHead] ?? null,
              this._part,
              updater,
            );
            // This marks the old part as having been used, so that it will be
            // skipped in the first two checks above.
            oldBindings[oldIndex] = undefined;
          } else {
            // No old part for this value; create a new one and insert it.
            newBindings[newHead] = mountItem(
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
      newBindings[newHead] = mountItem(
        newValues[newHead]!,
        this._part,
        updater,
      );
      newHead++;
    }

    // Remove any remaining unused old parts.
    while (oldHead <= oldTail) {
      const oldBinding = oldBindings[oldHead];
      if (oldBinding !== undefined) {
        unmountItem(oldBinding, updater);
      }
      oldHead++;
    }

    this._bindings = newBindings;
    this._keys = newKeys;
  }
}

class MountPart implements Effect {
  private _part: Part;

  private _listPart: Part;

  constructor(part: Part, listPart: Part) {
    this._part = part;
    this._listPart = listPart;
  }

  commit(): void {
    const referenceNode = this._listPart.node;
    referenceNode.before(this._part.node);
  }
}

class ReorderItem<T> implements Effect {
  private _binding: Binding<T>;

  private _referenceBinding: Binding<T> | null;

  private _listPart: Part;

  constructor(
    binding: Binding<T>,
    referenceBinding: Binding<T> | null,
    listPart: Part,
  ) {
    this._binding = binding;
    this._referenceBinding = referenceBinding;
    this._listPart = listPart;
  }

  commit(): void {
    const { startNode, endNode } = this._binding;
    const referenceNode =
      this._referenceBinding?.startNode ?? this._listPart.node;
    moveNodes(startNode, endNode, referenceNode);
  }
}

class UnmountPart implements Effect {
  private _itemPart: Part;

  constructor(part: Part) {
    this._itemPart = part;
  }

  commit(): void {
    this._itemPart.node.remove();
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

function mountItem<T>(value: T, listPart: Part, updater: Updater): Binding<T> {
  const part = {
    type: PartType.ChildNode,
    node: document.createComment(''),
  } as const;

  updater.enqueueMutationEffect(new MountPart(part, listPart));

  return createBinding(value, part, updater);
}

function moveNodes(
  startNode: Node,
  endNode: Node,
  referenceNode: ChildNode,
): void {
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

function reorderItem<T>(
  binding: Binding<T>,
  referenceBinding: Binding<T> | null,
  listPart: Part,
  updater: Updater,
): void {
  updater.enqueueMutationEffect(
    new ReorderItem(binding, referenceBinding, listPart),
  );
}

function unmountItem<T>(binding: Binding<T>, updater: Updater): void {
  binding.unbind(updater);

  updater.enqueueMutationEffect(new UnmountPart(binding.part));
}
