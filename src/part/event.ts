import { disconnectDirective } from '../directive.js';
import { Part } from '../part.js';
import type { Updater } from '../updater.js';

type EventValue =
  | EventListener
  | (EventListenerObject & AddEventListenerOptions);

export class EventPart implements Part {
  private readonly _element: Element;

  private readonly _name: string;

  private _pendingValue: EventValue | null = null;

  private _memoizedValue: EventValue | null = null;

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

  get value(): EventValue | null {
    return this._memoizedValue;
  }

  set value(newValue: unknown) {
    if (!isEventHandler(newValue)) {
      throw new Error(
        'A value of EventPart must be a EventListener, EventListenerObject or null.',
      );
    }

    this._pendingValue = newValue;
    this._dirty = true;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  commit(_updater: Updater): void {
    const oldValue = this._memoizedValue;
    const newValue = this._pendingValue;

    if (oldValue !== null) {
      if (typeof oldValue === 'function') {
        this._element.removeEventListener(this._name, oldValue);
      } else {
        this._element.removeEventListener(this._name, oldValue, oldValue);
      }
    }

    if (newValue !== null) {
      if (typeof newValue === 'function') {
        this._element.addEventListener(this._name, newValue);
      } else {
        this._element.addEventListener(this._name, newValue, newValue);
      }
    }

    this._memoizedValue = newValue;
    this._dirty = false;
  }

  disconnect(updater: Updater): void {
    disconnectDirective(this, updater);

    const value = this._memoizedValue;

    if (value !== null) {
      if (typeof value === 'function') {
        this._element.removeEventListener(this._name, value);
      } else {
        this._element.removeEventListener(this._name, value, value);
      }
    }
  }
}

function isEventHandler(value: unknown): value is EventValue {
  return (
    value === null ||
    typeof value === 'function' ||
    (typeof value === 'object' &&
      typeof (value as any).handleEvent === 'function')
  );
}
