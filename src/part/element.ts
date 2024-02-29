import { DisconnectPart, Part, mountPart, updatePart } from '../part.js';
import type { Updater } from '../updater.js';
import { AttributePart } from './attribute.js';
import { EventPart } from './event.js';
import { PropertyPart } from './property.js';

export type SpreadProps = { [key: string]: unknown };

export class ElementPart implements Part {
  private readonly _element: Element;

  private _pendingValue: ElementValue | null = null;

  private _committedValue: ElementValue | null = null;

  constructor(element: Element) {
    this._element = element;
  }

  get node(): Element {
    return this._element;
  }

  get value(): ElementValue | null {
    return this._committedValue;
  }

  setValue(newValue: unknown, _updater: Updater): void {
    this._pendingValue = ElementValue.lift(newValue, this._committedValue);
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

export abstract class ElementValue {
  static lift(newValue: unknown, oldValue: ElementValue | null) {
    if (newValue instanceof ElementValue) {
      return newValue;
    } else if (isSpreadProps(newValue)) {
      if (oldValue instanceof SpreadValue) {
        oldValue.setProps(newValue);
        return oldValue;
      } else {
        return new SpreadValue(newValue);
      }
    } else {
      throw new Error(
        'A value of the element part must be an "ElementValue" or object.',
      );
    }
  }

  abstract onMount(_part: ElementPart, _updater: Updater): void;

  abstract onUnmount(_part: ElementPart, _updater: Updater): void;

  abstract onUpdate(_part: ElementPart, _updater: Updater): void;
}

class SpreadValue extends ElementValue {
  private _pendingProps: SpreadProps;

  private _memoizedProps: SpreadProps = {};

  private _parts = new Map<string, Part>();

  constructor(props: SpreadProps) {
    super();
    this._pendingProps = props;
  }

  setProps(newProps: SpreadProps): void {
    this._pendingProps = newProps;
  }

  onMount(_part: ElementPart, _updater: Updater): void {}

  onUnmount(_part: ElementPart, updater: Updater): void {
    this._parts.forEach((part) => part.disconnect(updater));
    this._parts.clear();
  }

  onUpdate(part: ElementPart, updater: Updater) {
    const newProps = this._pendingProps;
    const oldProps = this._memoizedProps;

    if (newProps !== oldProps) {
      const newKeys = Object.keys(newProps);
      const oldKeys = Object.keys(oldProps);

      for (let i = 0, l = newKeys.length; i < l; i++) {
        const key = newKeys[i]!;
        const currentPart = this._parts.get(key);

        if (currentPart !== undefined) {
          updatePart(currentPart, oldProps[key], newProps[key], updater);
        } else {
          const newPart = createPart(key, part.node);
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

      this._memoizedProps = newProps;
    }
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
