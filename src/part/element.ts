import { disconnectDirective } from '../directive.js';
import type { Part } from '../part.js';
import type { Updater } from '../updater.js';
import { AttributePart } from './attribute.js';
import { EventPart } from './event.js';
import { PropertyPart } from './property.js';

export type ElementProps = { [key: string]: unknown };

export class ElementPart implements Part {
  private readonly _element: Element;

  private _pendingProps: ElementProps = {};

  private _memoizedProps: ElementProps = {};

  private _memoizedParts = new Map<string, Part>();

  private _dirty = true;

  constructor(element: Element) {
    this._element = element;
  }

  get node(): Element {
    return this._element;
  }

  get value(): ElementProps {
    return this._memoizedProps;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  set value(newProps: unknown) {
    if (!isElementProps(newProps)) {
      throw new Error('A value of the SpreadPart must be an object.');
    }

    this._pendingProps = newProps;
    this._dirty = true;
  }

  commit(updater: Updater): void {
    const newProps = this._pendingProps;
    const oldProps = this._memoizedProps;
    const newKeys = Object.keys(newProps);
    const oldKeys = Object.keys(oldProps);

    for (let i = 0, l = newKeys.length; i < l; i++) {
      const key = newKeys[i]!;
      let part = this._memoizedParts.get(key);

      if (part === undefined) {
        part = createPart(key, this._element);
        this._memoizedParts.set(key, part);
      }

      part.value = newProps[key];
      part.commit(updater);
    }

    for (let i = 0, l = oldKeys.length; i < l; i++) {
      const oldKey = oldKeys[i]!;

      if (!Object.hasOwn(newProps, oldKey)) {
        const oldPart = this._memoizedParts.get(oldKey)!;
        oldPart.disconnect(updater);
        this._memoizedParts.delete(oldKey);
      }
    }

    this._memoizedProps = this._pendingProps;
    this._dirty = false;
  }

  disconnect(updater: Updater): void {
    disconnectDirective(this, updater);

    this._memoizedParts.forEach((part) => part.disconnect(updater));
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

function isElementProps(value: unknown): value is ElementProps {
  return value !== null && typeof value === 'object';
}
