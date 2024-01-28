import type { Context } from './context';
import { directiveSymbol, isDirective } from './directive';
import type { Part } from './types';

export class AttributePart implements Part<AttributeValue> {
  private readonly _element: Element;

  private readonly _attributeName: string;

  private _pendingValue: AttributeValue | null = null;

  private _committedValue: AttributeValue | null = null;

  constructor(element: Element, attributeName: string) {
    this._element = element;
    this._attributeName = attributeName;
  }

  get node(): Element {
    return this._element;
  }

  get value(): AttributeValue | null {
    return this._committedValue;
  }

  get attributeName(): string {
    return this._attributeName;
  }

  setValue(newValue: unknown): void {
    this._pendingValue = AttributeValue.upgrade(newValue, this._committedValue);
  }

  commit(context: Context): void {
    const { _committedValue: oldValue, _pendingValue: newValue } = this;

    if (oldValue !== newValue) {
      if (oldValue) {
        oldValue.unmount(this, context);
      }

      if (newValue) {
        newValue.mount(this, context);
      }
    }

    if (newValue) {
      newValue.update(this, context);
    }

    this._committedValue = newValue;
  }

  disconnect(context: Context): void {
    if (this._committedValue) {
      this._committedValue.unmount(this, context);
    }
  }
}

export abstract class AttributeValue {
  static upgrade(newValue: unknown, oldValue: AttributeValue | null) {
    if (newValue instanceof AttributeValue) {
      return newValue;
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

  abstract mount(_part: AttributePart, _context: Context): void;

  abstract unmount(_part: AttributePart, _context: Context): void;

  abstract update(_part: AttributePart, _context: Context): void;
}

export class BooleanAttribute extends AttributeValue {
  private _value: boolean;

  constructor(value: boolean) {
    super();
    this._value = value;
  }

  get value(): boolean {
    return this._value;
  }

  set value(newValue: boolean) {
    this._value = newValue;
  }

  mount(_part: AttributePart, _context: Context): void {}

  unmount(_part: AttributePart, _context: Context): void {}

  update(part: AttributePart, _context: Context): void {
    const element = part.node;
    if (this._value) {
      element.setAttribute(part.attributeName, '');
    } else {
      element.removeAttribute(part.attributeName);
    }
  }
}

export class StringAttribute extends AttributeValue {
  private _value: string;

  constructor(value: string) {
    super();
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  set value(newValue: string) {
    this._value = newValue;
  }

  mount(_part: AttributePart, _context: Context): void {}

  unmount(_part: AttributePart, _context: Context): void {}

  update(part: AttributePart, _context: Context): void {
    const element = part.node;
    element.setAttribute(part.attributeName, this._value);
  }
}

export class EventPart implements Part<EventListener> {
  private readonly _element: Element;

  private readonly _eventName: string;

  private _committedValue: EventListener | null = null;

  private _pendingValue: EventListener | null = null;

  constructor(element: Element, eventName: string) {
    this._element = element;
    this._eventName = eventName;
  }

  get node(): Element {
    return this._element;
  }

  get value(): EventListener | null {
    return this._committedValue;
  }

  get eventName(): string {
    return this._eventName;
  }

  setValue(newValue: unknown): void {
    if (typeof newValue !== 'function') {
      throw new Error('The value of "EventPart" must be a function.');
    }

    this._pendingValue = newValue as EventListener;
  }

  commit(_context: Context): void {
    const {
      _element: element,
      _eventName: eventName,
      _committedValue: oldValue,
      _pendingValue: newValue,
    } = this;

    if (oldValue !== null) {
      element.removeEventListener(eventName, oldValue);
    }

    if (newValue !== null) {
      element.addEventListener(eventName, newValue);
    }

    this._committedValue = newValue;
  }

  disconnect(_context: Context): void {}
}

export class ChildPart implements Part<ChildValue> {
  protected readonly _node: ChildNode;

  protected _committedValue: ChildValue | null = null;

  private _pendingValue: ChildValue | null = null;

  constructor(node: ChildNode) {
    this._node = node;
  }

  get node(): ChildNode {
    return this._node;
  }

  get startNode(): ChildNode {
    return this._committedValue
      ? this._committedValue.startNode ?? this._node
      : this._node;
  }

  get endNode(): ChildNode {
    return this._node;
  }

  get value(): ChildValue | null {
    return this._committedValue;
  }

  setValue(newValue: unknown): void {
    this._pendingValue = ChildValue.upgrade(newValue, this._committedValue);
  }

  commit(context: Context): void {
    const oldValue = this._committedValue;
    const newValue = this._pendingValue!;

    if (oldValue !== newValue) {
      if (oldValue) {
        oldValue.unmount(this, context);
      }
      newValue.mount(this, context);
    }

    newValue.update(this, context);

    this._committedValue = newValue;
  }

  disconnect(context: Context): void {
    if (this._node.isConnected) {
      this._node.remove();
    }
    if (this._committedValue) {
      this._committedValue.unmount(this, context);
    }
  }
}

export abstract class ChildValue {
  static upgrade(value: unknown, oldValue: ChildValue | null): ChildValue {
    if (value instanceof ChildValue) {
      return value;
    } else if (value == null) {
      return oldValue instanceof NullChild ? oldValue : new NullChild();
    } else {
      if (oldValue instanceof TextChild) {
        oldValue.value = typeof value === 'string' ? value : value.toString();
        return oldValue;
      } else {
        return new TextChild(
          typeof value === 'string' ? value : value.toString(),
        );
      }
    }
  }

  abstract get startNode(): ChildNode | null;

  abstract get endNode(): ChildNode | null;

  abstract mount(_part: ChildPart, _context: Context): void;

  abstract unmount(_part: ChildPart, _context: Context): void;

  abstract update(_part: ChildPart, _context: Context): void;
}

class TextChild extends ChildValue {
  private _value: string;

  private readonly _node: Text;

  constructor(value: string) {
    super();
    this._value = value;
    this._node = document.createTextNode('');
  }

  get startNode(): Text {
    return this._node;
  }

  get endNode(): Text {
    return this._node;
  }

  get value(): string {
    return this._value;
  }

  set value(newValue: string) {
    this._value = newValue;
  }

  mount(part: ChildPart, _context: Context): void {
    const reference = part.endNode;
    reference.parentNode!.insertBefore(this._node, reference);
  }

  unmount(_part: ChildPart, _context: Context): void {
    if (this._node.isConnected) {
      this._node.remove();
    }
  }

  update(_part: ChildPart, _context: Context): void {
    this._node.textContent = this._value;
  }
}

class NullChild extends ChildValue {
  private readonly _node: Comment;

  constructor() {
    super();
    this._node = document.createComment('');
  }

  get startNode(): ChildNode {
    return this._node;
  }

  get endNode(): ChildNode {
    return this._node;
  }

  mount(part: ChildPart, _context: Context): void {
    const reference = part.endNode;
    reference.parentNode!.insertBefore(this._node, reference);
  }

  unmount(_part: ChildPart, _context: Context): void {
    if (this._node.isConnected) {
      this._node.remove();
    }
  }

  update(_part: ChildPart, _context: Context): void {}
}

export function mountPart(part: Part, value: unknown, context: Context): void {
  if (isDirective(value)) {
    value[directiveSymbol](part, context);
  } else {
    part.setValue(value);
    context.pushMutationEffect(part);
  }
}

export function updatePart(
  part: Part,
  oldValue: unknown,
  newValue: unknown,
  context: Context,
): void {
  if (Object.is(oldValue, newValue)) {
    return;
  }
  if (isDirective(newValue)) {
    newValue[directiveSymbol](part, context);
  } else {
    part.setValue(newValue);
    context.pushMutationEffect(part);
  }
}
