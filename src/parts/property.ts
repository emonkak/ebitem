import type { Part } from '../part.js';
import { Signal, Subscription } from '../signal.js';
import type { Updater } from '../updater.js';

export class PropertyPart implements Part {
  private readonly _element: Element;

  private readonly _name: string;

  private _committedValue: PropertyValue | null = null;

  private _pendingValue: PropertyValue | null = null;

  private _dirty = false;

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

  constructor(value: T) {
    super();
    this._value = value;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
  }

  mount(_part: PropertyPart, _updater: Updater): void {}

  unmount(_part: PropertyPart, _updater: Updater): void {}

  update(part: PropertyPart, _updater: Updater): void {
    (part.node as any)[part.name] = this._value;
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
      updater.pushMutationEffect(part);
      updater.requestUpdate();
    });
  }

  unmount(_part: PropertyPart, _updater: Updater): void {
    if (this._subscription !== null) {
      this._subscription();
      this._subscription = null;
    }
  }

  update(part: PropertyPart, updater: Updater): void {
    const { version } = this._signal;

    if (this._memoizedVersion < version) {
      this._memoizedValue = PropertyValue.upgrade(
        this._signal.value,
        this._memoizedValue,
      );
      this._memoizedVersion = version;
    }

    this._memoizedValue!.update(part, updater);
  }
}
