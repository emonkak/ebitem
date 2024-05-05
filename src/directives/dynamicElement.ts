import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  PartType,
  createBinding,
  directiveTag,
  updateBinding,
} from '../binding.js';
import type { Effect, Updater } from '../updater.js';

export function dynamicElement<TElementValue, TChildNodeValue>(
  type: string,
  elementValue: TElementValue,
  childNodeValue: TChildNodeValue,
): DynamicElementDirective<TElementValue, TChildNodeValue> {
  return new DynamicElementDirective(type, elementValue, childNodeValue);
}

export class DynamicElementDirective<TElementValue, TChildNodeValue>
  implements Directive
{
  private readonly _type: string;

  private readonly _elementValue: TElementValue;

  private readonly _childNodeValue: TChildNodeValue;

  constructor(
    type: string,
    elementValue: TElementValue,
    childNodeValue: TChildNodeValue,
  ) {
    this._type = type;
    this._elementValue = elementValue;
    this._childNodeValue = childNodeValue;
  }

  get type(): string {
    return this._type;
  }

  get elementValue(): TElementValue {
    return this._elementValue;
  }

  get childNodeValue(): TChildNodeValue {
    return this._childNodeValue;
  }

  [directiveTag](
    part: Part,
    updater: Updater,
  ): DynamicElementBinding<TElementValue, TChildNodeValue> {
    if (part.type !== PartType.ChildNode) {
      throw new Error('ElementDirective must be used in ChildNodePart.');
    }

    const element = document.createElement(this.type);
    const elementPart = { type: PartType.Element, node: element } as const;
    const elementBinding = createBinding(
      this._elementValue,
      elementPart,
      updater,
    );
    const childNodeMarker = document.createComment('');
    const childNodePart = {
      type: PartType.ChildNode,
      node: childNodeMarker,
    } as const;
    const childNodeBinding = createBinding(
      this.childNodeValue,
      childNodePart,
      updater,
    );

    element.appendChild(childNodeMarker);

    const binding = new DynamicElementBinding(
      this,
      elementBinding,
      childNodeBinding,
      part,
    );

    binding.init(updater);

    return binding;
  }
}

const DynamicElementBindingFlags = {
  NONE: 0,
  MUTATING: 1 << 0,
  UNMOUNTING: 1 << 1,
  REPARENTING: 1 << 2,
  MOUNTED: 1 << 3,
};

export class DynamicElementBinding<TElementValue, TChildNodeValue>
  implements
    Binding<DynamicElementDirective<TElementValue, TChildNodeValue>>,
    Effect
{
  private readonly _part: ChildNodePart;

  private _directive: DynamicElementDirective<TElementValue, TChildNodeValue>;

  private _elementBinding: Binding<TElementValue>;

  private _childNodeBinding: Binding<TChildNodeValue>;

  private _flags = DynamicElementBindingFlags.NONE;

  constructor(
    directive: DynamicElementDirective<TElementValue, TChildNodeValue>,
    elementBinding: Binding<TElementValue>,
    childNodeBinding: Binding<TChildNodeValue>,
    part: ChildNodePart,
  ) {
    this._directive = directive;
    this._elementBinding = elementBinding;
    this._childNodeBinding = childNodeBinding;
    this._part = part;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._flags & DynamicElementBindingFlags.MOUNTED
      ? this._elementBinding.part.node
      : this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): DynamicElementDirective<TElementValue, TChildNodeValue> {
    return this._directive;
  }

  set value(newDirective: DynamicElementDirective<
    TElementValue,
    TChildNodeValue
  >) {
    this._directive = newDirective;
  }

  bind(updater: Updater): void {
    const { type, elementValue, childNodeValue } = this._directive;
    const element = this._elementBinding.part.node;

    if (element.nodeName !== type.toUpperCase()) {
      const elementPart = {
        type: PartType.Element,
        node: document.createElement(this._directive.type),
      } as const;

      this._elementBinding.disconnect();
      this._elementBinding = createBinding(elementValue, elementPart, updater);

      this._requestMutation(updater);
      this._flags |= DynamicElementBindingFlags.REPARENTING;
    } else {
      updateBinding(this._elementBinding, elementValue, updater);

      if (!(this._flags & DynamicElementBindingFlags.MOUNTED)) {
        this._requestMutation(updater);
      }
    }

    updateBinding(this._childNodeBinding, childNodeValue, updater);

    this._flags &= ~DynamicElementBindingFlags.UNMOUNTING;
  }

  unbind(updater: Updater): void {
    this._requestMutation(updater);
    this._flags |= DynamicElementBindingFlags.UNMOUNTING;
  }

  disconnect(): void {
    this._elementBinding.disconnect();
    this._childNodeBinding.disconnect();
  }

  commit(): void {
    if (this._flags & DynamicElementBindingFlags.UNMOUNTING) {
      const element = this._elementBinding.part.node;

      element.remove();

      this._flags &= ~DynamicElementBindingFlags.MOUNTED;
    } else {
      const element = this._elementBinding.part.node as Element;
      const referenceNode = this._part.node;

      if (this._flags & DynamicElementBindingFlags.REPARENTING) {
        const oldElement = this._childNodeBinding.part.node
          .parentNode as Element | null;
        if (oldElement !== null) {
          element.replaceChildren(...oldElement.childNodes);
          oldElement.remove();
        }
      }

      referenceNode.before(element);

      this._flags |= DynamicElementBindingFlags.MOUNTED;
    }

    this._flags &= ~(
      DynamicElementBindingFlags.MUTATING |
      DynamicElementBindingFlags.UNMOUNTING |
      DynamicElementBindingFlags.REPARENTING
    );
  }

  init(updater: Updater): void {
    this._requestMutation(updater);
  }

  private _requestMutation(updater: Updater) {
    if (!(this._flags & DynamicElementBindingFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= DynamicElementBindingFlags.MUTATING;
    }
  }
}
