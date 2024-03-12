import type {
  AttributePart,
  Effect,
  ElementPart,
  EventPart,
  NamedPart,
  Part,
  PropertyPart,
  Updater,
} from './types.js';

export type PrimitiveBinding = Binding<any, any>;

export interface Binding<TValue, TContext = unknown> {
  get part(): Part;
  get startNode(): ChildNode;
  get endNode(): ChildNode;
  set value(newValue: TValue);
  get value(): TValue;
  bind(updater: Updater<TContext>): void;
  unbind(updater: Updater): void;
  disconnect(): void;
}

export interface Directive<TContext = unknown> {
  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): Binding<ThisType<this>>;
}

export type SpreadProps = { [key: string]: unknown };

export const directiveTag = Symbol('Directive');

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

  init(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
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
        `A value that ${this.constructor.name} binds must be EventListener, EventListenerObject or null.`,
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

  get value(): unknown {
    return this._memoizedListener;
  }

  set value(newValue: unknown) {
    if (newValue == null) {
      this._pendingListener = null;
    } else if (isEventListener(newValue)) {
      this._pendingListener = newValue;
    } else {
      throw new Error(
        `A value that ${this.constructor.name} binds must be EventListener, EventListenerObject or null.`,
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
      throw new Error(`A value of ${this.constructor.name} must be an object.`);
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

  get value(): unknown {
    return this._props;
  }

  set value(newValue: unknown) {
    if (!isSpreadProps(newValue)) {
      throw new Error(`A value of ${this.constructor.name} must be an object.`);
    }

    this._props = newValue;
  }

  bind(updater: Updater): void {
    const newProps = this._props;
    const newKeys = Object.keys(this._props);

    for (let i = 0, l = newKeys.length; i < l; i++) {
      const key = newKeys[i]!;
      let binding = this._bindings.get(key);

      if (binding !== undefined) {
        binding = updateBinding(binding, newProps[key], updater);
      } else {
        const part = resolveNamedPart(this._part.node, key);
        binding = createBinding(part, newProps[key], updater);
      }
      this._bindings.set(key, binding);
    }

    for (const [oldKey, oldBinding] of this._bindings.entries()) {
      if (!Object.hasOwn(newProps, oldKey)) {
        oldBinding.unbind(updater);
        this._bindings.delete(oldKey);
      }
    }

    this._props = newProps;
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

export function createBinding<T>(
  part: Part,
  value: T,
  updater: Updater,
): Binding<T> {
  if (isDirective(value)) {
    return value[directiveTag](part, updater) as Binding<T>;
  } else {
    const binding = resolvePrimitiveBinding(part, value);
    binding.bind(updater);
    return binding;
  }
}

export function updateBinding<T>(
  binding: Binding<unknown>,
  newValue: T,
  updater: Updater,
  force = false,
): Binding<T> {
  const oldValue = binding.value;

  if (!force && Object.is(oldValue, newValue)) {
    return binding as Binding<T>;
  }

  if (isDirective(newValue)) {
    if (isDirective(oldValue) && isPrototypeOf(oldValue, newValue)) {
      binding.value = newValue;
      binding.bind(updater);
    } else {
      binding.unbind(updater);
      binding = newValue[directiveTag](binding.part, updater);
    }
  } else {
    if (isDirective(oldValue)) {
      binding.unbind(updater);
      binding = resolvePrimitiveBinding(binding.part, newValue);
    }
    binding.value = newValue;
    binding.bind(updater);
  }

  return binding as Binding<T>;
}

export function boot<TContext>(
  directive: Directive<TContext>,
  container: ChildNode,
  updater: Updater<TContext>,
) {
  const part = {
    type: 'childNode',
    node: document.createComment(''),
  } as const;

  updater.enqueueMutationEffect({
    commit() {
      container.appendChild(part.node);
    },
  });

  directive[directiveTag](part, updater);
}

function isDirective(value: unknown): value is Directive {
  return value !== null && typeof value === 'object' && directiveTag in value;
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

function isPrototypeOf<T extends object>(
  first: T,
  second: object,
): second is T {
  return Object.prototype.isPrototypeOf.call(
    Object.getPrototypeOf(first),
    second,
  );
}

function isSpreadProps(value: unknown): value is SpreadProps {
  return value !== null && typeof value === 'object';
}

function resolveNamedPart(element: Element, name: string): NamedPart {
  if (name.length > 1 && name[0] === '@') {
    return { type: 'event', node: element, name: name.slice(1) };
  } else if (name.length > 1 && name[0] === '.') {
    return { type: 'property', node: element, name: name.slice(1) };
  } else {
    return { type: 'attribute', node: element, name };
  }
}

function resolvePrimitiveBinding(part: Part, value: unknown): PrimitiveBinding {
  switch (part.type) {
    case 'attribute':
      return new AttributeBinding(part, value);
    case 'childNode':
      return new NodeBinding(part, value);
    case 'element':
      return new SpreadBinding(part, value);
    case 'event':
      return new EventBinding(part, value);
    case 'node':
      return new NodeBinding(part, value);
    case 'property':
      return new PropertyBinding(part, value);
  }
}
