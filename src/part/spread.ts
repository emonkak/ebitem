import { DisconnectPart, Part, mountPart, updatePart } from '../part.js';
import type { Updater } from '../updater.js';
import { AttributePart } from './attribute.js';
import { EventPart } from './event.js';
import { PropertyPart } from './property.js';

export type SpreadProps = { [key: string]: unknown };

export class SpreadPart implements Part {
  private readonly _element: Element;

  private _pendingProps: SpreadProps = {};

  private _memoizedProps: SpreadProps = {};

  private _parts = new Map<string, Part>();

  constructor(element: Element) {
    this._element = element;
  }

  get node(): Element {
    return this._element;
  }

  get value(): SpreadProps {
    return this._memoizedProps;
  }

  setValue(newProps: unknown, updater: Updater): void {
    if (!isSpreadProps(newProps)) {
      throw new Error('The value of "SpreadPart" must be an object.');
    }

    const oldProps = this._memoizedProps;
    const oldKeys = Object.keys(oldProps);
    const newKeys = Object.keys(newProps);

    for (let i = 0, l = newKeys.length; i < l; i++) {
      const key = newKeys[i]!;
      const exsistingPart = this._parts.get(key);
      if (exsistingPart !== undefined) {
        updatePart(exsistingPart, oldProps[key], newProps[key], updater);
      } else {
        const newPart = createPart(key, this._element);
        mountPart(newPart, newProps[key], updater);
        this._parts.set(key, newPart);
      }
    }

    for (let i = 0, l = oldKeys.length; i < l; i++) {
      const key = oldKeys[i]!;
      if (!Object.hasOwn(newProps, key)) {
        const oldPart = this._parts.get(key)!;
        this._parts.delete(key);
        updater.enqueueMutationEffect(new DisconnectPart(oldPart));
      }
    }

    this._pendingProps = newProps;
  }

  commit(_updater: Updater): void {
    this._memoizedProps = this._pendingProps;
  }

  disconnect(updater: Updater): void {
    this._parts.forEach((part) => part.disconnect(updater));
    this._parts.clear();
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
