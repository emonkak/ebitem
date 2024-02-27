import type { Part } from '../part.js';
import { Signal, Subscription } from '../signal.js';
import type { Updater } from '../updater.js';

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

  setValue(newValue: unknown, _updater: Updater): void {
    this._pendingValue = ChildValue.lift(newValue, this._committedValue);
  }

  commit(updater: Updater): void {
    const oldValue = this._committedValue;
    const newValue = this._pendingValue;

    if (oldValue !== newValue) {
      if (oldValue !== null) {
        oldValue.onUnmount(this, updater);
      }

      if (newValue !== null) {
        newValue.onMount(this, updater);
      }
    }

    if (newValue !== null) {
      newValue.onUpdate(this, updater);
    }

    this._committedValue = newValue;
  }

  disconnect(updater: Updater): void {
    if (this._committedValue !== null) {
      this._committedValue.onUnmount(this, updater);
      this._committedValue = null;
    }
  }
}

export abstract class ChildValue {
  static lift(newValue: unknown, oldValue: ChildValue | null): ChildValue {
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

  abstract onMount(_part: ChildPart, _updater: Updater): void;

  abstract onUnmount(_part: ChildPart, _updater: Updater): void;

  abstract onUpdate(_part: ChildPart, _updater: Updater): void;
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

  onMount(part: ChildPart, _updater: Updater): void {
    const reference = part.endNode;
    reference.parentNode!.insertBefore(this._node, reference);
  }

  onUnmount(_part: ChildPart, _updater: Updater): void {
    this._node.remove();
  }

  onUpdate(_part: ChildPart, _updater: Updater): void {}
}

export class SignalChild<T> extends ChildValue {
  private readonly _signal: Signal<T>;

  private _mountedValue: ChildValue | null = null;

  private _mountedVersion = 0;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>) {
    super();
    this._signal = signal;
  }

  get signal(): Signal<T> {
    return this._signal;
  }

  get startNode(): ChildNode | null {
    return this._mountedValue?.startNode ?? null;
  }

  get endNode(): ChildNode | null {
    return this._mountedValue?.endNode ?? null;
  }

  onMount(part: ChildPart, updater: Updater): void {
    this._mountedValue = ChildValue.lift(this._signal.value, null);
    this._mountedVersion = this._signal.version;
    this._mountedValue.onMount(part, updater);

    this._subscription = this._signal.subscribe(() => {
      updater.enqueueMutationEffect(part);
      updater.requestUpdate();
    });
  }

  onUnmount(part: ChildPart, updater: Updater): void {
    if (this._subscription !== null) {
      this._subscription();
      this._subscription = null;
    }

    if (this._mountedValue !== null) {
      this._mountedValue.onUnmount(part, updater);
      this._mountedValue = null;
      this._mountedVersion = 0;
    }
  }

  onUpdate(part: ChildPart, updater: Updater): void {
    const newVersion = this._signal.version;

    if (this._mountedVersion < newVersion) {
      const oldValue = this._mountedValue;
      const newValue = ChildValue.lift(this._signal.value, oldValue);

      if (oldValue !== null) {
        oldValue.onUnmount(part, updater);
      }

      newValue.onMount(part, updater);

      this._mountedValue = newValue;
      this._mountedVersion = newVersion;
    }

    this._mountedValue!.onUpdate(part, updater);
  }
}

export class TextChild extends ChildValue {
  private readonly _node: Text;

  private _value: string;

  private _dirty = true;

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
    this._dirty = true;
  }

  onMount(part: ChildPart, _updater: Updater): void {
    const reference = part.endNode;
    reference.parentNode!.insertBefore(this._node, reference);
  }

  onUnmount(_part: ChildPart, _updater: Updater): void {
    this._node.remove();
  }

  onUpdate(_part: ChildPart, _updater: Updater): void {
    if (this._dirty) {
      this._node.textContent = this._value;
      this._dirty = false;
    }
  }
}
