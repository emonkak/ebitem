import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  PartType,
  SpreadBinding,
  SpreadProps,
  createBinding,
  directiveTag,
  updateBinding,
} from '../binding.js';
import type { Effect, Updater } from '../updater.js';

export function dynamicElement<TChildNodeValue>(
  type: string,
  props: SpreadProps,
  childNodeValue: TChildNodeValue,
): DynamicElementDirective<TChildNodeValue> {
  return new DynamicElementDirective(type, props, childNodeValue);
}

export class DynamicElementDirective<TChildNodeValue> implements Directive {
  private readonly _type: string;

  private readonly _props: SpreadProps;

  private readonly _childNodeValue: TChildNodeValue;

  constructor(
    type: string,
    props: SpreadProps,
    childNodeValue: TChildNodeValue,
  ) {
    this._type = type;
    this._props = props;
    this._childNodeValue = childNodeValue;
  }

  get type(): string {
    return this._type;
  }

  get props(): SpreadProps {
    return this._props;
  }

  get childNodeValue(): TChildNodeValue {
    return this._childNodeValue;
  }

  [directiveTag](
    part: Part,
    updater: Updater,
  ): DynamicElementBinding<TChildNodeValue> {
    if (part.type !== PartType.ChildNode) {
      throw new Error('ElementDirective must be used in ChildNodePart.');
    }

    const element = document.createElement(this.type);
    const elementPart = { type: PartType.Element, node: element } as const;
    const elementBinding = new SpreadBinding(this.props, elementPart);
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

    elementBinding.bind(updater);

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

export class DynamicElementBinding<TChildNodeValue>
  implements Binding<DynamicElementDirective<TChildNodeValue>>, Effect
{
  private readonly _part: ChildNodePart;

  private _directive: DynamicElementDirective<TChildNodeValue>;

  private _elementBinding: SpreadBinding;

  private _childNodeBinding: Binding<TChildNodeValue>;

  private _flags = DynamicElementBindingFlags.NONE;

  constructor(
    directive: DynamicElementDirective<TChildNodeValue>,
    elementBinding: SpreadBinding,
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

  get value(): DynamicElementDirective<TChildNodeValue> {
    return this._directive;
  }

  set value(newDirective: DynamicElementDirective<TChildNodeValue>) {
    this._directive = newDirective;
  }

  bind(updater: Updater): void {
    const { type, props, childNodeValue } = this._directive;
    const element = this._elementBinding.part.node;

    if (element.nodeName !== type.toUpperCase()) {
      const elementPart = {
        type: PartType.Element,
        node: document.createElement(this._directive.type),
      } as const;

      this._elementBinding.disconnect();

      this._elementBinding = new SpreadBinding(props, elementPart);
      this._elementBinding.bind(updater);

      this._requestMutation(updater);
      this._flags |= DynamicElementBindingFlags.REPARENTING;
    } else {
      updateBinding(this._elementBinding, props, updater);

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
    this._spreadBinding.bind(updater);
    this._childNodeBinding.bind(updater);
    this._requestMutation(updater);
  }

  private _requestMutation(updater: Updater) {
    if (!(this._flags & DynamicElementBindingFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= DynamicElementBindingFlags.MUTATING;
    }
  }
}
