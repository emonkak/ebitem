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

  get value(): PropertyValue | null {
    return this._committedValue;
  }

  setValue(newValue: unknown, _updater: Updater): void {
    this._pendingValue = PropertyValue.lift(newValue, this._committedValue);
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

export abstract class PropertyValue {
  static lift(newValue: unknown, oldValue: PropertyValue | null) {
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

  abstract onMount(_part: PropertyPart, _updater: Updater): void;

  abstract onUnmount(_part: PropertyPart, _updater: Updater): void;

  abstract onUpdate(_part: PropertyPart, _updater: Updater): void;
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

  onMount(_part: PropertyPart, _updater: Updater): void {}

  onUnmount(_part: PropertyPart, _updater: Updater): void {}

  onUpdate(part: PropertyPart, _updater: Updater): void {
    if (this._dirty) {
      (part.node as any)[part.name] = this._value;
      this._dirty = false;
    }
  }
}

export class SignalProperty<T> extends PropertyValue {
  private readonly _signal: Signal<T>;

  private _mountedValue: PropertyValue | null = null;

  private _mountedVersion = 0;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>) {
    super();
    this._signal = signal;
  }

  get signal(): Signal<T> {
    return this._signal;
  }

  onMount(part: PropertyPart, updater: Updater): void {
    this._mountedValue = PropertyValue.lift(this._signal.value, null);
    this._mountedVersion = this._signal.version;
    this._mountedValue.onMount(part, updater);

    this._subscription = this._signal.subscribe(() => {
      updater.enqueueMutationEffect(part);
      updater.requestUpdate();
    });
  }

  onUnmount(part: PropertyPart, updater: Updater): void {
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

  onUpdate(part: PropertyPart, updater: Updater): void {
    const newVersion = this._signal.version;

    if (this._mountedVersion < newVersion) {
      const oldValue = this._mountedValue;
      const newValue = PropertyValue.lift(this._signal.value, oldValue);

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
