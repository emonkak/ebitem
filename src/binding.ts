import {
  AttributePart,
  Binding,
  Effect,
  ElementPart,
  EventPart,
  NamedPart,
  Part,
  PartType,
  PropertyPart,
  Updater,
  directiveTag,
  isDirective,
} from './types.js';

export type SpreadProps = { [key: string]: unknown };

export class AttributeBinding implements Binding<unknown>, Effect {
  private readonly _part: AttributePart;

  private _value: unknown;

  private _dirty = false;

  constructor(part: AttributePart, value: unknown) {
    this._part = part;
    this._value = value;
  }

  get part(): AttributePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): unknown {
    return this._value;
  }

  set value(newValue: unknown) {
    this._value = newValue;
  }

  bind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater) {
    this._value = null;
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  disconnect(): void {}

  commit(): void {
    const { node, name } = this._part;
    const value = this._value;

    if (typeof value === 'string') {
      node.setAttribute(name, value);
    } else if (typeof value === 'boolean') {
      node.toggleAttribute(name, value);
    } else if (value == null) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, value.toString());
    }

    this._dirty = false;
  }
}

export class EventBinding implements Binding<unknown>, Effect {
  private readonly _part: EventPart;

  private _pendingListener: EventListenerOrEventListenerObject | null;

  private _memoizedListener: EventListenerOrEventListenerObject | null = null;

  private _dirty = false;

  constructor(part: EventPart, value: unknown) {
    this._part = part;

    if (value == null) {
      this._pendingListener = null;
    } else if (isEventListener(value)) {
      this._pendingListener = value;
    } else {
      throw new Error(
        'A value that EventBinding binds must be EventListener, EventListenerObject or null.',
      );
    }
  }

  get part(): EventPart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): EventListenerOrEventListenerObject | null {
    return this._pendingListener;
  }

  set value(newValue: unknown) {
    if (newValue == null) {
      this._pendingListener = null;
    } else if (isEventListener(newValue)) {
      this._pendingListener = newValue;
    } else {
      throw new Error(
        'A value that EventBinding binds must be EventListener, EventListenerObject or null.',
      );
    }
  }

  bind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater) {
    this._pendingListener = null;

    if (!this._dirty && this._memoizedListener !== null) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  disconnect(): void {}

  commit(): void {
    const oldListener = this._memoizedListener;
    const newListener = this._pendingListener;

    // If both are functions, the event listener options are the same.
    // Therefore, there is no need to re-register the event listener.
    if (typeof oldListener === 'object' || typeof newListener === 'object') {
      if (oldListener !== null) {
        const { node, name } = this._part;

        if (typeof oldListener === 'function') {
          node.removeEventListener(name, this);
        } else {
          node.removeEventListener(
            name,
            this,
            oldListener as AddEventListenerOptions,
          );
        }
      }

      if (newListener !== null) {
        const { node, name } = this._part;

        if (typeof newListener === 'function') {
          node.addEventListener(name, this);
        } else {
          node.addEventListener(
            name,
            this,
            newListener as AddEventListenerOptions,
          );
        }
      }
    }

    this._memoizedListener = this._pendingListener;
    this._dirty = false;
  }

  handleEvent(event: Event): void {
    if (typeof this._memoizedListener === 'function') {
      this._memoizedListener(event);
    } else {
      this._memoizedListener!.handleEvent(event);
    }
  }
}

export class NodeBinding implements Binding<unknown>, Effect {
  private readonly _part: Part;

  private _value: unknown;

  private _dirty = false;

  constructor(part: Part, value: unknown) {
    this._part = part;
    this._value = value;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): unknown {
    return this._value;
  }

  set value(newValue: unknown) {
    this._value = newValue;
  }

  bind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater) {
    this._value = null;

    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  disconnect(): void {}

  commit(): void {
    this._part.node.nodeValue =
      this._value != null ? this._value.toString() : null;
    this._dirty = false;
  }
}

export class PropertyBinding implements Binding<unknown>, Effect {
  private readonly _part: PropertyPart;

  private _value: unknown;

  private _dirty = false;

  constructor(part: PropertyPart, value: unknown) {
    this._part = part;
    this._value = value;
  }

  get part(): PropertyPart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): unknown {
    return this._value;
  }

  set value(newValue: unknown) {
    this._value = newValue;
  }

  bind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(_updater: Updater) {}

  disconnect(): void {}

  commit(): void {
    const { node, name } = this._part;
    (node as any)[name] = this._value;
    this._dirty = false;
  }
}

export class SpreadBinding implements Binding<unknown> {
  private readonly _part: ElementPart;

  private _props: SpreadProps;

  private _bindings: Map<PropertyKey, Binding<unknown>> = new Map();

  constructor(part: ElementPart, value: unknown) {
    if (!isSpreadProps(value)) {
      throw new Error('A value of SpreadBinding must be an object.');
    }

    this._part = part;
    this._props = value;
  }

  get part(): ElementPart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): SpreadProps {
    return this._props;
  }

  set value(newValue: unknown) {
    if (!isSpreadProps(newValue)) {
      throw new Error('A value of SpreadBinding must be an object.');
    }

    this._props = newValue;
  }

  bind(updater: Updater): void {
    for (const key in this._props) {
      const value = this._props[key];
      let binding = this._bindings.get(key);

      if (binding !== undefined) {
        if (!Object.is(binding.value, value)) {
          binding = updateBinding(binding, value, updater);
        }
      } else {
        const part = resolveNamedPart(this._part.node, key);
        binding = initBinding(part, value, updater);
      }

      this._bindings.set(key, binding);
    }

    for (const [oldKey, oldBinding] of this._bindings.entries()) {
      if (!(oldKey in this._props)) {
        oldBinding.unbind(updater);
        this._bindings.delete(oldKey);
      }
    }
  }

  unbind(updater: Updater) {
    this._props = {};
    this._bindings.forEach((binding) => {
      binding.unbind(updater);
    });
    this._bindings.clear();
  }

  disconnect(): void {
    this._bindings.forEach((binding) => {
      binding.disconnect();
    });
  }
}

export function initBinding<TValue, TContext>(
  part: Part,
  value: TValue,
  updater: Updater<TContext>,
): Binding<TValue, TContext> {
  if (isDirective(value)) {
    return value[directiveTag](part, updater) as Binding<TValue, TContext>;
  } else {
    const binding = resolvePrimitiveBinding(part, value);
    binding.bind(updater);
    return binding;
  }
}

export function resolvePrimitiveBinding(
  part: Part,
  value: unknown,
): Binding<any> {
  switch (part.type) {
    case PartType.ATTRIBUTE:
      return new AttributeBinding(part, value);
    case PartType.CHILD_NODE:
      return new NodeBinding(part, value);
    case PartType.ELEMENT:
      return new SpreadBinding(part, value);
    case PartType.EVENT:
      return new EventBinding(part, value);
    case PartType.NODE:
      return new NodeBinding(part, value);
    case PartType.PROPERTY:
      return new PropertyBinding(part, value);
  }
}

export function updateBinding<TValue, TContext>(
  binding: Binding<TValue, TContext>,
  newValue: TValue,
  updater: Updater<TContext>,
): Binding<TValue> {
  const oldValue = binding.value;

  if (isDirective(newValue)) {
    if (isDirective(oldValue) && samePrototype(oldValue, newValue)) {
      binding.value = newValue;
      binding.bind(updater);
    } else {
      binding.unbind(updater);
      binding = newValue[directiveTag](
        binding.part,
        updater,
      ) as Binding<TValue>;
    }
  } else {
    if (isDirective(oldValue)) {
      binding.unbind(updater);
      binding = resolvePrimitiveBinding(binding.part, newValue);
    }
    binding.value = newValue;
    binding.bind(updater);
  }

  return binding;
}

function isEventListener(
  value: object,
): value is EventListenerOrEventListenerObject {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' &&
      typeof (value as any).handleEvent === 'function')
  );
}

function isSpreadProps(value: unknown): value is SpreadProps {
  return value !== null && typeof value === 'object';
}

function resolveNamedPart(element: Element, name: string): NamedPart {
  if (name.length > 1 && name[0] === '@') {
    return { type: PartType.EVENT, node: element, name: name.slice(1) };
  } else if (name.length > 1 && name[0] === '.') {
    return { type: PartType.PROPERTY, node: element, name: name.slice(1) };
  } else {
    return { type: PartType.ATTRIBUTE, node: element, name };
  }
}

function samePrototype<T extends object>(base: T, target: object): target is T {
  return Object.prototype.isPrototypeOf.call(
    Object.getPrototypeOf(base),
    target,
  );
}
