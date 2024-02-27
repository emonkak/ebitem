import type { Part } from '../part.js';
import { Signal, Subscription } from '../signal.js';
import type { Updater } from '../updater.js';

export class AttributePart implements Part {
  private readonly _element: Element;

  private readonly _name: string;

  private _pendingValue: AttributeValue | null = null;

  private _committedValue: AttributeValue | null = null;

  constructor(element: Element, name: string) {
    this._element = element;
    this._name = name;
  }

  get node(): Element {
    return this._element;
  }

  get value(): AttributeValue | null {
    return this._committedValue;
  }

  get name(): string {
    return this._name;
  }

  setValue(newValue: unknown, _updater: Updater): void {
    this._pendingValue = AttributeValue.upgrade(newValue, this._committedValue);
  }

  commit(updater: Updater): void {
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
  }

  disconnect(updater: Updater): void {
    if (this._committedValue !== null) {
      this._committedValue.unmount(this, updater);
      this._committedValue = null;
    }
  }
}

export abstract class AttributeValue {
  static upgrade(newValue: unknown, oldValue: AttributeValue | null) {
    if (newValue instanceof AttributeValue) {
      return newValue;
    } else if (newValue instanceof Signal) {
      if (oldValue instanceof SignalAttribute && oldValue.signal === newValue) {
        return oldValue;
      }
      return new SignalAttribute(newValue);
    } else if (typeof newValue === 'boolean') {
      if (oldValue instanceof BooleanAttribute) {
        oldValue.value = newValue;
        return oldValue;
      }
      return new BooleanAttribute(newValue);
    } else if (newValue == null) {
      if (oldValue instanceof BooleanAttribute) {
        oldValue.value = false;
        return oldValue;
      }
      return new BooleanAttribute(false);
    } else {
      const stringValue =
        typeof newValue === 'string' ? newValue : newValue.toString();
      if (oldValue instanceof StringAttribute) {
        oldValue.value = stringValue;
        return oldValue;
      }
      return new StringAttribute(stringValue);
    }
  }

  abstract mount(_part: AttributePart, _updater: Updater): void;

  abstract unmount(_part: AttributePart, _updater: Updater): void;

  abstract update(_part: AttributePart, _updater: Updater): void;
}

export class BooleanAttribute extends AttributeValue {
  private _value: boolean;

  private _dirty = true;

  constructor(value: boolean) {
    super();
    this._value = value;
  }

  get value(): boolean {
    return this._value;
  }

  set value(newValue: boolean) {
    this._value = newValue;
    this._dirty = true;
  }

  mount(_part: AttributePart, _updater: Updater): void {}

  unmount(_part: AttributePart, _updater: Updater): void {}

  update(part: AttributePart, _updater: Updater): void {
    if (this._dirty) {
      if (this._value) {
        part.node.setAttribute(part.name, '');
      } else {
        part.node.removeAttribute(part.name);
      }
      this._dirty = false;
    }
  }
}

export class SignalAttribute<T> extends AttributeValue {
  private readonly _signal: Signal<T>;

  private _memoizedValue: AttributeValue | null = null;

  private _memoizedVersion = 0;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>) {
    super();
    this._signal = signal;
  }

  get signal(): Signal<T> {
    return this._signal;
  }

  mount(part: AttributePart, updater: Updater): void {
    this._subscription = this._signal.subscribe(() => {
      updater.enqueueMutationEffect(part);
      updater.requestUpdate();
    });
    this._memoizedValue = AttributeValue.upgrade(this._signal.value, null);
    this._memoizedVersion = this._signal.version;
    this._memoizedValue.mount(part, updater);
  }

  unmount(part: AttributePart, updater: Updater): void {
    if (this._subscription !== null) {
      this._subscription();
      this._subscription = null;
    }
    if (this._memoizedValue !== null) {
      this._memoizedValue.unmount(part, updater);
      this._memoizedValue = null;
      this._memoizedVersion = 0;
    }
  }

  update(part: AttributePart, updater: Updater): void {
    const newVersion = this._signal.version;

    if (this._memoizedVersion < newVersion) {
      const oldValue = this._memoizedValue;

      if (oldValue !== null) {
        oldValue.unmount(part, updater);
      }

      const newValue = AttributeValue.upgrade(this._signal.value, oldValue);

      newValue.mount(part, updater);

      this._memoizedValue = newValue;
      this._memoizedVersion = newVersion;
    }

    this._memoizedValue!.update(part, updater);
  }
}

export class StringAttribute extends AttributeValue {
  private _value: string;

  private _dirty = true;

  constructor(value: string) {
    super();
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  set value(newValue: string) {
    this._value = newValue;
    this._dirty = true;
  }

  mount(_part: AttributePart, _updater: Updater): void {}

  unmount(_part: AttributePart, _updater: Updater): void {}

  update(part: AttributePart, _updater: Updater): void {
    if (this._dirty) {
      part.node.setAttribute(part.name, this._value);
      this._dirty = false;
    }
  }
}
