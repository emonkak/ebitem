import { disconnectDirective } from '../directive.js';
import { Part } from '../part.js';
import type { Updater } from '../updater.js';

export class AttributePart implements Part {
  private readonly _element: Element;

  private readonly _name: string;

  private _pendingValue: unknown | null = null;

  private _memoizedValue: unknown | null = null;

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
    return this._memoizedValue;
  }

  set value(newValue: unknown) {
    this._pendingValue = newValue;
    this._dirty = true;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  commit(_updater: Updater): void {
    const newValue = this._pendingValue;

    if (newValue != null) {
      this._element.setAttribute(this._name, newValue.toString());
    } else {
      this._element.removeAttribute(this._name);
    }

    this._memoizedValue = newValue;
    this._dirty = false;
  }

  disconnect(updater: Updater): void {
    disconnectDirective(this, updater);

    if (this._memoizedValue != null) {
      this._element.removeAttribute(this._name);
    }
  }
}
