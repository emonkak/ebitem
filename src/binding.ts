import { Effect, Updater } from './updater.js';

export interface Binding<TValue, TContext = unknown> {
  get part(): Part;
  get startNode(): ChildNode;
  get endNode(): ChildNode;
  set value(newValue: TValue);
  get value(): TValue;
  bind(updater: Updater<TContext>): void;
  unbind(updater: Updater<TContext>): void;
  disconnect(): void;
}

export interface Directive<TContext = unknown> {
  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): Binding<ThisType<this>>;
}

export type Part =
  | AttributePart
  | ChildNodePart
  | ElementPart
  | EventPart
  | NodePart
  | PropertyPart;

export enum PartType {
  Attribute,
  ChildNode,
  Element,
  Event,
  Node,
  Property,
}

export interface AttributePart {
  type: PartType.Attribute;
  node: Element;
  name: string;
}

export interface ChildNodePart {
  type: PartType.ChildNode;
  node: ChildNode;
}

export interface ElementPart {
  type: PartType.Element;
  node: Element;
}

export interface EventPart {
  type: PartType.Event;
  node: Element;
  name: string;
}

export interface PropertyPart {
  type: PartType.Property;
  node: Element;
  name: string;
}

export interface NodePart {
  type: PartType.Node;
  node: ChildNode;
}

export type SpreadProps = { [key: string]: unknown };

export const directiveTag = Symbol('Directive');

export class AttributeBinding implements Binding<unknown>, Effect {
  private readonly _part: AttributePart;

  private _value: unknown;

  private _dirty = false;

  constructor(value: unknown, part: AttributePart) {
    this._value = value;
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

  unbind(updater: Updater): void {
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

  constructor(value: unknown, part: EventPart) {
    if (value == null) {
      this._pendingListener = null;
    } else if (isEventListener(value)) {
      this._pendingListener = value;
    } else {
      throw new Error(
        'A value that EventBinding binds must be EventListener, EventListenerObject or null.',
      );
    }
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

  get value(): unknown {
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

  unbind(updater: Updater): void {
    this._pendingListener = null;

    if (!this._dirty && this._memoizedListener !== null) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  disconnect(): void {
    const listener = this._memoizedListener;

    if (listener !== null) {
      const { node, name } = this._part;

      if (typeof listener === 'function') {
        node.removeEventListener(name, this);
      } else {
        node.removeEventListener(
          name,
          this,
          listener as AddEventListenerOptions,
        );
      }

      this._memoizedListener = null;
    }
  }

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
    const listener = this._memoizedListener!;
    if (typeof listener === 'function') {
      listener(event);
    } else {
      listener.handleEvent(event);
    }
  }
}

export class NodeBinding implements Binding<unknown>, Effect {
  private readonly _part: Part;

  private _value: unknown;

  private _dirty = false;

  constructor(value: unknown, part: Part) {
    this._value = value;
    this._part = part;
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

  unbind(updater: Updater): void {
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

  constructor(value: unknown, part: PropertyPart) {
    this._value = value;
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

  private _bindings: Map<string, Binding<unknown>> = new Map();

  constructor(value: unknown, part: ElementPart) {
    if (!isSpreadProps(value)) {
      throw new Error('A value of SpreadBinding must be an object.');
    }

    this._props = value;
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
    for (const name in this._props) {
      const value = this._props[name];
      if (value === undefined) {
        continue;
      }

      let binding = this._bindings.get(name);

      if (binding !== undefined) {
        if (!Object.is(binding.value, value)) {
          binding = updateBinding(binding, value, updater);
        }
      } else {
        const part = resolveSpreadPart(name, this._part.node);
        binding = initializeBinding(value, part, updater);
      }

      this._bindings.set(name, binding);
    }

    for (const [oldName, oldBinding] of this._bindings.entries()) {
      if (!(oldName in this._props) || this._props[oldName] === undefined) {
        oldBinding.unbind(updater);
        this._bindings.delete(oldName);
      }
    }
  }

  unbind(updater: Updater): void {
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

export function initializeBinding<TValue, TContext>(
  value: TValue,
  part: Part,
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

export function mountBinding<TValue, TContext>(
  value: TValue,
  container: ChildNode,
  updater: Updater<TContext>,
): Binding<TValue> {
  const part = {
    type: PartType.ChildNode,
    node: document.createComment(''),
  } as const;

  updater.enqueueMutationEffect({
    commit() {
      container.appendChild(part.node);
    },
  });

  const binding = initializeBinding(value, part, updater);

  updater.scheduleUpdate();

  return binding;
}

export function updateBinding<TValue, TContext>(
  binding: Binding<TValue, TContext>,
  newValue: TValue,
  updater: Updater<TContext>,
): Binding<TValue> {
  const oldValue = binding.value;

  if (isDirective(newValue)) {
    if (isDirective(oldValue) && isPrototypeOf(oldValue, newValue)) {
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

function isDirective(value: unknown): value is Directive<unknown> {
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

function isPrototypeOf<T extends object>(base: T, target: object): target is T {
  return Object.prototype.isPrototypeOf.call(
    Object.getPrototypeOf(base),
    target,
  );
}

function isSpreadProps(value: unknown): value is SpreadProps {
  return value !== null && typeof value === 'object';
}

function resolvePrimitiveBinding(part: Part, value: unknown): Binding<any> {
  switch (part.type) {
    case PartType.Attribute:
      return new AttributeBinding(value, part);
    case PartType.ChildNode:
      return new NodeBinding(value, part);
    case PartType.Element:
      return new SpreadBinding(value, part);
    case PartType.Event:
      return new EventBinding(value, part);
    case PartType.Node:
      return new NodeBinding(value, part);
    case PartType.Property:
      return new PropertyBinding(value, part);
  }
}

function resolveSpreadPart(name: string, element: Element): Part {
  if (name.length > 1 && name[0] === '@') {
    return { type: PartType.Event, node: element, name: name.slice(1) };
  } else if (name.length > 1 && name[0] === '.') {
    return { type: PartType.Property, node: element, name: name.slice(1) };
  } else {
    return { type: PartType.Attribute, node: element, name };
  }
}
