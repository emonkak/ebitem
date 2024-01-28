import type { Part } from '../part';
import { Signal, Subscription } from '../signal';
import type { Updater } from '../updater';

export class ChildPart implements Part {
  protected readonly _node: ChildNode;

  protected _committedValue: ChildValue | null = null;

  private _pendingValue: ChildValue | null = null;

  constructor(node: ChildNode) {
    this._node = node;
  }

  get node(): ChildNode {
    return this._node;
  }

  get startNode(): ChildNode {
    return this._committedValue
      ? this._committedValue.startNode ?? this._node
      : this._node;
  }

  get endNode(): ChildNode {
    return this._node;
  }

  get value(): ChildValue | null {
    return this._committedValue;
  }

  setValue(newValue: unknown): void {
    this._pendingValue = ChildValue.upgrade(newValue, this._committedValue);
  }

  commit(updater: Updater<unknown>): void {
    const oldValue = this._committedValue;
    const newValue = this._pendingValue!;

    if (oldValue !== newValue) {
      if (oldValue) {
        oldValue.unmount(this, updater);
      }
      newValue.mount(this, updater);
    }

    newValue.update(this, updater);

    this._committedValue = newValue;
  }

  disconnect(updater: Updater<unknown>): void {
    if (this._node.isConnected) {
      this._node.remove();
    }
    if (this._committedValue) {
      this._committedValue.unmount(this, updater);
    }
  }
}

export abstract class ChildValue {
  static upgrade(newValue: unknown, oldValue: ChildValue | null): ChildValue {
    if (newValue instanceof ChildValue) {
      return newValue;
    } else if (newValue instanceof Signal) {
      if (oldValue instanceof SignalChild && oldValue.signal === newValue) {
        return oldValue;
      }
      return new SignalChild(newValue);
    } else if (newValue == null) {
      return oldValue instanceof NullChild ? oldValue : new NullChild();
    } else {
      if (oldValue instanceof TextChild) {
        oldValue.value =
          typeof newValue === 'string' ? newValue : newValue.toString();
        return oldValue;
      } else {
        return new TextChild(
          typeof newValue === 'string' ? newValue : newValue.toString(),
        );
      }
    }
  }

  abstract get startNode(): ChildNode | null;

  abstract get endNode(): ChildNode | null;

  abstract mount(_part: ChildPart, _updater: Updater<unknown>): void;

  abstract unmount(_part: ChildPart, _updater: Updater<unknown>): void;

  abstract update(_part: ChildPart, _updater: Updater<unknown>): void;
}

export class NullChild extends ChildValue {
  private readonly _node: Comment;

  constructor() {
    super();
    this._node = document.createComment('');
  }

  get startNode(): ChildNode {
    return this._node;
  }

  get endNode(): ChildNode {
    return this._node;
  }

  mount(part: ChildPart, _updater: Updater<unknown>): void {
    const reference = part.endNode;
    reference.parentNode!.insertBefore(this._node, reference);
  }

  unmount(_part: ChildPart, _updater: Updater<unknown>): void {
    if (this._node.isConnected) {
      this._node.remove();
    }
  }

  update(_part: ChildPart, _updater: Updater<unknown>): void {}
}

export class SignalChild<T> extends ChildValue {
  private readonly _signal: Signal<T>;

  private _memoizedValue: ChildValue | null = null;

  private _memoizedVersion = 0;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>) {
    super();
    this._signal = signal;
  }

  get signal(): Signal<T> {
    return this._signal;
  }

  get startNode(): ChildNode | null {
    return this._memoizedValue?.startNode ?? null;
  }

  get endNode(): ChildNode | null {
    return this._memoizedValue?.endNode ?? null;
  }

  mount(part: ChildPart, updater: Updater<unknown>): void {
    this._subscription = this._signal.subscribe(() => {
      updater.pushMutationEffect(part);
      updater.requestMutations();
    });
  }

  unmount(_part: ChildPart, _updater: Updater<unknown>): void {
    if (this._subscription !== null) {
      this._subscription();
      this._subscription = null;
    }
  }

  update(part: ChildPart, updater: Updater<unknown>): void {
    const version = this._signal.version;

    if (this._memoizedVersion < version) {
      this._memoizedValue = ChildValue.upgrade(
        this._signal.value,
        this._memoizedValue,
      );
      this._memoizedVersion = version;
    }

    this._memoizedValue!.update(part, updater);
  }
}

export class TextChild extends ChildValue {
  private _value: string;

  private readonly _node: Text;

  constructor(value: string) {
    super();
    this._value = value;
    this._node = document.createTextNode('');
  }

  get startNode(): Text {
    return this._node;
  }

  get endNode(): Text {
    return this._node;
  }

  get value(): string {
    return this._value;
  }

  set value(newValue: string) {
    this._value = newValue;
  }

  mount(part: ChildPart, _updater: Updater<unknown>): void {
    const reference = part.endNode;
    reference.parentNode!.insertBefore(this._node, reference);
  }

  unmount(_part: ChildPart, _updater: Updater<unknown>): void {
    if (this._node.isConnected) {
      this._node.remove();
    }
  }

  update(_part: ChildPart, _updater: Updater<unknown>): void {
    this._node.textContent = this._value;
  }
}
