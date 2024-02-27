import type { Part } from '../part.js';
import { Signal, Subscription } from '../signal.js';
import type { Updater } from '../updater.js';

export class PropertyPart implements Part {
  private readonly _element: Element;

  private readonly _name: string;

  private _committedValue: PropertyValue | null = null;

  private _pendingValue: PropertyValue | null = null;

  constructor(element: Element, name: string) {
    this._element = element;
    this._name = name;
  }

  get node(): Element {
    return this._element;
  }

  get name(): string {
    return this._name;
  }

  get value(): unknown {
    return this._committedValue;
  }

  setValue(newValue: unknown, _updater: Updater): void {
    this._pendingValue = PropertyValue.upgrade(newValue, this._committedValue);
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

export abstract class PropertyValue {
  static upgrade(newValue: unknown, oldValue: PropertyValue | null) {
    if (newValue instanceof PropertyValue) {
      return newValue;
    } else if (newValue instanceof Signal) {
      if (oldValue instanceof SignalProperty && oldValue.signal === newValue) {
        return oldValue;
      }
      return new SignalProperty(newValue);
    } else {
      if (oldValue instanceof ValueProperty && oldValue.value === newValue) {
        oldValue.value = newValue;
        return oldValue;
      }
      return new ValueProperty(newValue);
    }
  }

  abstract mount(_part: PropertyPart, _updater: Updater): void;

  abstract unmount(_part: PropertyPart, _updater: Updater): void;

  abstract update(_part: PropertyPart, _updater: Updater): void;
}

export class ValueProperty<T> extends PropertyValue {
  private _value: T;

  private _dirty = true;

  constructor(value: T) {
    super();
    this._value = value;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
    this._dirty = true;
  }

  mount(_part: PropertyPart, _updater: Updater): void {}

  unmount(_part: PropertyPart, _updater: Updater): void {}

  update(part: PropertyPart, _updater: Updater): void {
    if (this._dirty) {
      (part.node as any)[part.name] = this._value;
      this._dirty = false;
    }
  }
}

export class SignalProperty<T> extends PropertyValue {
  private readonly _signal: Signal<T>;

  private _memoizedValue: PropertyValue | null = null;

  private _memoizedVersion = 0;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>) {
    super();
    this._signal = signal;
  }

  get signal(): Signal<T> {
    return this._signal;
  }

  mount(part: PropertyPart, updater: Updater): void {
    this._subscription = this._signal.subscribe(() => {
      updater.enqueueMutationEffect(part);
      updater.requestUpdate();
    });
    this._memoizedValue = PropertyValue.upgrade(this._signal.value, null);
    this._memoizedVersion = this._signal.version;
    this._memoizedValue.mount(part, updater);
  }

  unmount(part: PropertyPart, updater: Updater): void {
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

  update(part: PropertyPart, updater: Updater): void {
    const newVersion = this._signal.version;

    if (this._memoizedVersion < newVersion) {
      const oldValue = this._memoizedValue;

      if (oldValue !== null) {
        oldValue.unmount(part, updater);
      }

      const newValue = PropertyValue.upgrade(this._signal.value, oldValue);

      newValue.mount(part, updater);

      this._memoizedValue = newValue;
      this._memoizedVersion = newVersion;
    }

    this._memoizedValue!.update(part, updater);
  }
}
