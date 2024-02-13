import { DisconnectPart, Part, mountPart, updatePart } from '../part.js';
import type { Updater } from '../updater.js';
import { AttributePart } from './attribute.js';
import { EventPart } from './event.js';
import { PropertyPart } from './property.js';

export type SpreadProps = { [key: string]: unknown };

export class SpreadPart implements Part {
  private readonly _element: Element;

  private _pendingProps: SpreadProps = {};

  private _committedProps: SpreadProps = {};

  private _pendingParts = new Map<string, Part>();

  private _committedParts = new Map<string, Part>();

  constructor(element: Element) {
    this._element = element;
  }

  get node(): Element {
    return this._element;
  }

  get value(): SpreadProps {
    return this._committedProps;
  }

  setValue(newProps: unknown, updater: Updater): void {
    if (!isSpreadProps(newProps)) {
      throw new Error('The value of "SpreadPart" must be an object.');
    }

    if (this._committedProps !== newProps) {
      const oldProps = this._committedProps;
      const newParts = new Map();
      const newKeys = Object.keys(newProps);

      for (let i = 0, l = newKeys.length; i < l; i++) {
        const key = newKeys[i]!;
        let part = this._committedParts.get(key);
        if (part !== undefined) {
          updatePart(part, oldProps[key], newProps[key], updater);
        } else {
          part = createPart(key, this._element);
          mountPart(part, newProps[key], updater);
        }
        newParts.set(key, part);
      }

      for (const [key, oldPart] of this._committedParts.entries()) {
        if (!newParts.has(key)) {
          updater.pushMutationEffect(new DisconnectPart(oldPart));
        }
      }

      this._pendingProps = newProps;
      this._pendingParts = newParts;
    }
  }

  commit(_updater: Updater): void {
    this._committedProps = this._pendingProps;
    this._committedParts = this._pendingParts;
  }

  disconnect(updater: Updater): void {
    this._committedParts.forEach((part) => part.disconnect(updater));
    this._committedParts.clear();
  }
}

function createPart(name: string, element: Element): Part {
  if (name.length > 1 && name[0] === '@') {
    return new EventPart(element, name.slice(1));
  } else if (name.length > 1 && name[0] === '.') {
    return new PropertyPart(element, name.slice(1));
  } else {
    return new AttributePart(element, name);
  }
}

function isSpreadProps(value: unknown): value is SpreadProps {
  return value !== null && typeof value === 'object';
}
