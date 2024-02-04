import type { Part } from '../part.js';
import type { Updater } from '../updater.js';

export class EventPart implements Part {
  private readonly _element: Element;

  private readonly _name: string;

  private _committedValue: EventListener | null = null;

  private _pendingValue: EventListener | null = null;

  private _dirty = false;

  constructor(element: Element, name: string) {
    this._element = element;
    this._name = name;
  }

  get node(): Element {
    return this._element;
  }

  get value(): EventListener | null {
    return this._committedValue;
  }

  get name(): string {
    return this._name;
  }

  setValue(newValue: unknown): void {
    if (newValue !== null && typeof newValue !== 'function') {
      throw new Error('The value of "EventPart" must be a function or null.');
    }

    this._pendingValue = newValue as EventListener | null;
  }

  commit(_updater: Updater): void {
    if (!this._dirty) {
      return;
    }

    const {
      _element: element,
      _name: name,
      _committedValue: oldValue,
      _pendingValue: newValue,
    } = this;

    if (oldValue !== null) {
      element.removeEventListener(name, oldValue);
    }

    if (newValue !== null) {
      element.addEventListener(name, newValue);
    }

    this._committedValue = newValue;
    this._dirty = false;
  }

  disconnect(_updater: Updater): void {
    if (this._committedValue) {
      // The element may be retained by someone, so we remove the event listener
      // to avoid memory leaks.
      this._element.removeEventListener(this._name, this._committedValue);
    }
  }
}
