import { Effect, Updater } from './updater.js';

export type Part =
  | AttributePart
  | ChildNodePart
  | ElementPart
  | EventPart
  | NodePart
  | PropertyPart;

export type NamedPart = AttributePart | EventPart | PropertyPart;

export interface AttributePart {
  type: 'attribute';
  node: Element;
  name: string;
}

export interface ChildNodePart {
  type: 'childNode';
  node: ChildNode;
}

export interface ElementPart {
  type: 'element';
  node: Element;
}

export interface EventPart {
  type: 'event';
  node: Element;
  name: string;
}

export interface PropertyPart {
  type: 'property';
  node: Element;
  name: string;
}

export interface NodePart {
  type: 'node';
  node: ChildNode;
}

export interface Binding<TValue, TContext = unknown> {
  get part(): Part;
  get startNode(): ChildNode;
  get endNode(): ChildNode;
  bind(value: TValue, updater: Updater<TContext>): void;
  unbind(updater: Updater): void;
  disconnect(): void;
}

export type BindValueOf<T> = T extends Directive<infer Value> ? Value : T;

export interface Directive<TValue, TContext = unknown> {
  [directiveTag](part: Part, updater: Updater<TContext>): Binding<TValue>;
  valueOf(): TValue;
}

export type SpreadProps = { [key: string]: unknown };

export const directiveTag = Symbol('Directive.createBinding');

export class AttributeBinding implements Binding<unknown>, Effect {
  private readonly _part: AttributePart;

  private _value: unknown = null;

  private _dirty = false;

  constructor(part: AttributePart) {
    this._part = part;
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

  bind(value: unknown, updater: Updater): void {
    this._value = value;
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

const ChildNodeBindingFlags = {
  NONE: 0,
  MUTATING: 1 << 0,
  MOUNTED: 1 << 1,
};

export class ChildNodeBinding implements Binding<unknown>, Effect {
  private readonly _part: ChildNodePart;

  private readonly _nodeBinding: NodeBinding;

  private _flags = ChildNodeBindingFlags.NONE;

  constructor(part: ChildNodePart, node: ChildNode) {
    this._part = part;
    this._nodeBinding = new NodeBinding({ type: 'node', node });
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._nodeBinding.part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(value: unknown, updater: Updater): void {
    this._nodeBinding.bind(value, updater);

    if (
      !(this._flags & ChildNodeBindingFlags.MUTATING) &&
      !(this._flags & ChildNodeBindingFlags.MOUNTED)
    ) {
      updater.enqueueMutationEffect(this);
      this._flags |= ChildNodeBindingFlags.MUTATING;
    }
  }

  unbind(updater: Updater) {
    if (
      !(this._flags & ChildNodeBindingFlags.MUTATING) &&
      this._flags & ChildNodeBindingFlags.MOUNTED
    ) {
      updater.enqueueMutationEffect(this);
      this._flags |= ChildNodeBindingFlags.MUTATING;
    }
  }

  disconnect(): void {}

  commit(): void {
    const node = this._nodeBinding.part.node;

    if (this._flags & ChildNodeBindingFlags.MOUNTED) {
      node.remove();
      this._flags &= ~ChildNodeBindingFlags.MOUNTED;
    } else {
      const reference = this._part.node;
      reference.before(node);
      this._flags |= ChildNodeBindingFlags.MOUNTED;
    }

    this._flags &= ~ChildNodeBindingFlags.MUTATING;
  }
}

export class EventBinding implements Binding<unknown>, Effect {
  private readonly _part: EventPart;

  private _pendingListener: EventListenerOrEventListenerObject | null = null;

  private _memoizedListener: EventListenerOrEventListenerObject | null = null;

  private _dirty = false;

  constructor(part: EventPart) {
    this._part = part;
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

  bind(value: unknown, updater: Updater): void {
    if (value == null) {
      this._pendingListener = null;
    } else if (isEventListener(value)) {
      this._pendingListener = value;
    } else {
      throw new Error(
        `A value that ${this.constructor.name} binds must be EventListener, EventListenerObject or null.`,
      );
    }

    if (
      typeof this._memoizedListener === 'function' &&
      typeof value === 'function'
    ) {
      // If both are functions, the event listener options are the same.
      // Therefore, there is no need to re-register the event listener.
      this._memoizedListener = value;
    } else {
      if (!this._dirty) {
        updater.enqueueMutationEffect(this);
        this._dirty = true;
      }
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
    if (this._memoizedListener !== null) {
      const { node, name } = this._part;
      const oldListener = this._memoizedListener;

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

    if (this._pendingListener !== null) {
      const { node, name } = this._part;
      const newListener = this._pendingListener;

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
  private readonly _part: NodePart;

  private _value: unknown = null;

  private _dirty = false;

  constructor(part: NodePart) {
    this._part = part;
  }

  get part(): NodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(value: unknown, updater: Updater): void {
    this._value = value;

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
      this._value == null ? null : this._value.toString();
    this._dirty = false;
  }
}

export class PropertyBinding implements Binding<unknown>, Effect {
  private readonly _part: PropertyPart;

  private _value: unknown = null;

  private _dirty = false;

  constructor(part: PropertyPart) {
    this._part = part;
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

  bind(value: unknown, updater: Updater): void {
    this._value = value;
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

  private _props: SpreadProps = {};

  private _bindings: Map<PropertyKey, Binding<unknown>> = new Map();

  constructor(part: ElementPart) {
    this._part = part;
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

  bind(newProps: unknown, updater: Updater): void {
    if (!isSpreadProps(newProps)) {
      throw new Error(`A value of ${this.constructor.name} must be an object.`);
    }

    const oldProps = this._props;
    const newKeys = Object.keys(newProps);
    const oldKeys = Object.keys(oldProps);

    for (let i = 0, l = newKeys.length; i < l; i++) {
      const key = newKeys[i]!;
      let binding = this._bindings.get(key);

      if (binding !== undefined) {
        binding = checkAndUpdateBinding(
          binding,
          oldProps[key],
          newProps[key],
          updater,
        );
      } else {
        const part = resolveNamedPart(this._part.node, key);
        binding = createBinding(part, newProps[key], updater);
      }
      this._bindings.set(key, binding);
    }

    for (let i = 0, l = oldKeys.length; i < l; i++) {
      const oldKey = oldKeys[i]!;

      if (!Object.hasOwn(newProps, oldKey)) {
        const oldBinding = this._bindings.get(oldKey)!;
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
): Binding<BindValueOf<T>> {
  let binding: Binding<unknown>;

  if (isDirective(value)) {
    binding = value[directiveTag](part, updater);
  } else {
    binding = resolvePrimitiveBinding(part);
    binding.bind(value, updater);
  }

  return binding;
}

export function updateBinding<T>(
  binding: Binding<BindValueOf<T>>,
  oldValue: T,
  newValue: T,
  updater: Updater,
): Binding<BindValueOf<T>> {
  if (isDirective(newValue)) {
    if (isDirective(oldValue) && isPrototypeOf(newValue, oldValue)) {
      binding.bind(newValue.valueOf(), updater);
    } else {
      binding.unbind(updater);
      binding = newValue[directiveTag](binding.part, updater);
    }
  } else {
    if (isDirective(oldValue)) {
      binding.unbind(updater);
      binding = resolvePrimitiveBinding(binding.part);
    }
    binding.bind(newValue as BindValueOf<T>, updater);
  }

  return binding;
}

export function checkAndUpdateBinding<T>(
  binding: Binding<BindValueOf<T>>,
  oldValue: T,
  newValue: T,
  updater: Updater,
): Binding<BindValueOf<T>> {
  if (Object.is(oldValue, newValue)) {
    return binding;
  }

  if (isDirective(newValue)) {
    if (isDirective(oldValue) && isPrototypeOf(newValue, oldValue)) {
      if (Object.is(newValue.valueOf(), oldValue.valueOf())) {
        return binding;
      }
      binding.bind(newValue.valueOf(), updater);
    } else {
      binding.unbind(updater);
      binding = newValue[directiveTag](binding.part, updater);
    }
  } else {
    if (isDirective(oldValue)) {
      binding.unbind(updater);
      binding = resolvePrimitiveBinding(binding.part);
    }
    binding.bind(newValue as BindValueOf<T>, updater);
  }

  return binding;
}

function isDirective(value: unknown): value is Directive<any> {
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

function isPrototypeOf(first: object, second: object): boolean {
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

function resolvePrimitiveBinding(part: Part): Binding<unknown> {
  switch (part.type) {
    case 'attribute':
      return new AttributeBinding(part);
    case 'childNode':
      return new ChildNodeBinding(part, document.createTextNode(''));
    case 'element':
      return new SpreadBinding(part);
    case 'event':
      return new EventBinding(part);
    case 'node':
      return new NodeBinding(part);
    case 'property':
      return new PropertyBinding(part);
  }
}
