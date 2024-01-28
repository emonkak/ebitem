import { Part } from '../part';
import { Updater } from '../updater';

export class EventPart implements Part {
  private readonly _element: Element;

  private readonly _name: string;

  private _committedValue: EventListener | null = null;

  private _pendingValue: EventListener | null = null;

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
    if (typeof newValue !== 'function') {
      throw new Error('The value of "EventPart" must be a function.');
    }

    this._pendingValue = newValue as EventListener;
  }

  commit(_updater: Updater<unknown>): void {
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
  }

  disconnect(_updater: Updater<unknown>): void {}
}
