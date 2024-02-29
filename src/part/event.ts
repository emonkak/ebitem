import type { Part } from '../part.js';
import type { Updater } from '../updater.js';

type EventListenerWithOptions = EventListenerOrEventListenerObject &
  AddEventListenerOptions;

export class EventPart implements Part {
  private readonly _element: Element;

  private readonly _name: string;

  private _committedValue: EventListenerWithOptions | null = null;

  private _pendingValue: EventListenerWithOptions | null = null;

  constructor(element: Element, name: string) {
    this._element = element;
    this._name = name;
  }

  get node(): Element {
    return this._element;
  }

  get value(): EventListenerWithOptions | null {
    return this._committedValue;
  }

  get name(): string {
    return this._name;
  }

  setValue(newValue: unknown, _updater: Updater): void {
    if (
      !(
        newValue === null ||
        typeof newValue === 'function' ||
        (typeof newValue === 'object' &&
          typeof (newValue as any).handleEvent === 'function')
      )
    ) {
      throw new Error(
        'A value of the event part must be a EventListener, EventListenerObject or null.',
      );
    }

    this._pendingValue = newValue as EventListenerWithOptions | null;
  }

  commit(_updater: Updater): void {
    const {
      _element: element,
      _name: name,
      _committedValue: oldValue,
      _pendingValue: newValue,
    } = this;

    if (oldValue !== newValue) {
      if (oldValue !== null) {
        element.removeEventListener(name, this, oldValue);
      }

      if (newValue !== null) {
        element.addEventListener(name, this, newValue);
      }

      this._committedValue = newValue;
    }
  }

  disconnect(_updater: Updater): void {
    if (this._committedValue !== null) {
      // The element may be retained by someone, so we remove the event listener
      // to avoid memory leaks.
      this._element.removeEventListener(this._name, this, this._committedValue);
      this._committedValue = null;
    }
  }

  handleEvent(event: Event): void {
    const value = this._committedValue;
    if (value !== null) {
      if (typeof value === 'function') {
        value.call(this._element, event);
      } else {
        value.handleEvent(event);
      }
    }
  }
}
