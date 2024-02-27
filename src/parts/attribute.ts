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
    this._pendingValue = AttributeValue.lift(newValue, this._committedValue);
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

export abstract class AttributeValue {
  static lift(newValue: unknown, oldValue: AttributeValue | null) {
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

  abstract onMount(_part: AttributePart, _updater: Updater): void;

  abstract onUnmount(_part: AttributePart, _updater: Updater): void;

  abstract onUpdate(_part: AttributePart, _updater: Updater): void;
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

  onMount(_part: AttributePart, _updater: Updater): void {}

  onUnmount(_part: AttributePart, _updater: Updater): void {}

  onUpdate(part: AttributePart, _updater: Updater): void {
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

  private _mountedValue: AttributeValue | null = null;

  private _mountedVersion = 0;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>) {
    super();
    this._signal = signal;
  }

  get signal(): Signal<T> {
    return this._signal;
  }

  onMount(part: AttributePart, updater: Updater): void {
    this._mountedValue = AttributeValue.lift(this._signal.value, null);
    this._mountedVersion = this._signal.version;
    this._mountedValue.onMount(part, updater);

    this._subscription = this._signal.subscribe(() => {
      updater.enqueueMutationEffect(part);
      updater.requestUpdate();
    });
  }

  onUnmount(part: AttributePart, updater: Updater): void {
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

  onUpdate(part: AttributePart, updater: Updater): void {
    const newVersion = this._signal.version;

    if (this._mountedVersion < newVersion) {
      const oldValue = this._mountedValue;
      const newValue = AttributeValue.lift(this._signal.value, oldValue);

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

  onMount(_part: AttributePart, _updater: Updater): void {}

  onUnmount(_part: AttributePart, _updater: Updater): void {}

  onUpdate(part: AttributePart, _updater: Updater): void {
    if (this._dirty) {
      part.node.setAttribute(part.name, this._value);
      this._dirty = false;
    }
  }
}
