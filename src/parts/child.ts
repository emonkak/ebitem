import type { Part } from '../part.js';
import { Signal, Subscription } from '../signal.js';
import type { Updater } from '../updater.js';

export class ChildPart implements Part {
  protected readonly _node: ChildNode;

  protected _committedValue: ChildValue | null = null;

  private _pendingValue: ChildValue | null = null;

  private _dirty = false;

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

  setValue(newValue: unknown, _updater: Updater): void {
    this._pendingValue = ChildValue.upgrade(newValue, this._committedValue);
    this._dirty = true;
  }

  commit(updater: Updater): void {
    if (!this._dirty) {
      return;
    }

    const oldValue = this._committedValue;
    const newValue = this._pendingValue;

    if (oldValue !== newValue) {
      if (oldValue !== null) {
        oldValue.unmount(this, updater);
      }

      if (newValue !== null) {
        newValue.mount(this, updater);
      }
    }

    if (newValue !== null) {
      newValue.update(this, updater);
    }

    this._committedValue = newValue;
    this._dirty = false;
  }

  disconnect(updater: Updater): void {
    if (this._committedValue !== null) {
      this._committedValue.unmount(this, updater);
      this._committedValue = null;
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
      const stringValue =
        typeof newValue === 'string' ? newValue : newValue.toString();
      if (oldValue instanceof TextChild) {
        oldValue.value = stringValue;
        return oldValue;
      } else {
        return new TextChild(stringValue);
      }
    }
  }

  abstract get startNode(): ChildNode | null;

  abstract get endNode(): ChildNode | null;

  abstract mount(_part: ChildPart, _updater: Updater): void;

  abstract unmount(_part: ChildPart, _updater: Updater): void;

  abstract update(_part: ChildPart, _updater: Updater): void;
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

  mount(part: ChildPart, _updater: Updater): void {
    const reference = part.endNode;
    reference.parentNode!.insertBefore(this._node, reference);
  }

  unmount(_part: ChildPart, _updater: Updater): void {
    this._node.remove();
  }

  update(_part: ChildPart, _updater: Updater): void {}
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

  mount(part: ChildPart, updater: Updater): void {
    this._subscription = this._signal.subscribe(() => {
      part.setValue(this, updater);
      updater.pushMutationEffect(part);
      updater.requestUpdate();
    });
  }

  unmount(_part: ChildPart, _updater: Updater): void {
    if (this._subscription !== null) {
      this._subscription();
      this._subscription = null;
    }
  }

  update(part: ChildPart, updater: Updater): void {
    const { version } = this._signal;

    if (this._memoizedVersion < version) {
      const oldValue = this._memoizedValue;

      if (oldValue !== null) {
        oldValue.unmount(part, updater);
      }

      const newValue = ChildValue.upgrade(
        this._signal.value,
        this._memoizedValue,
      );

      newValue.mount(part, updater);

      this._memoizedValue = newValue;
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

  mount(part: ChildPart, _updater: Updater): void {
    const reference = part.endNode;
    reference.parentNode!.insertBefore(this._node, reference);
  }

  unmount(_part: ChildPart, _updater: Updater): void {
    this._node.remove();
  }

  update(_part: ChildPart, _updater: Updater): void {
    this._node.textContent = this._value;
  }
}
