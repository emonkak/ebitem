import {
  Binding,
  Directive,
  SpreadBinding,
  SpreadProps,
  createBinding,
  directiveTag,
  updateBinding,
} from '../binding.js';
import type { ChildNodePart, Effect, Part, Updater } from '../types.js';

export function slot<TChildNodeValue>(
  type: string,
  props: SpreadProps,
  childNodeValue: TChildNodeValue,
): SlotDirective<TChildNodeValue> {
  return new SlotDirective(type, props, childNodeValue);
}

export class SlotDirective<TChildNodeValue> implements Directive {
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

  [directiveTag](part: Part, updater: Updater): SlotBinding<TChildNodeValue> {
    if (part.type !== 'childNode') {
      throw new Error(
        `${this.constructor.name} must be used in ChildNodePart.`,
      );
    }

    const element = document.createElement(this._type);
    const childMarker = document.createComment('');

    element.appendChild(childMarker);

    const elementPart = { type: 'element', node: element } as const;
    const spreadBinding = new SpreadBinding(elementPart, this._props);

    spreadBinding.bind(updater);

    const childNodePart = { type: 'childNode', node: childMarker } as const;
    const childNodeBinding = createBinding(
      childNodePart,
      this._childNodeValue,
      updater,
    );

    const binding = new SlotBinding(
      part,
      this,
      spreadBinding,
      childNodeBinding,
    );

    binding.init(updater);

    return binding;
  }
}

const SlotBindingFlags = {
  NONE: 0,
  MUTATING: 1 << 0,
  UNMOUNTING: 1 << 1,
  REPARENTING: 1 << 2,
  MOUNTED: 1 << 3,
};

export class SlotBinding<TChildNodeValue>
  implements Binding<SlotDirective<TChildNodeValue>>, Effect
{
  private readonly _part: ChildNodePart;

  private _directive: SlotDirective<TChildNodeValue>;

  private _spreadBinding: SpreadBinding;

  private _childNodeBinding: Binding<TChildNodeValue>;

  private _flags = SlotBindingFlags.NONE;

  constructor(
    part: ChildNodePart,
    directive: SlotDirective<TChildNodeValue>,
    spreadBinding: SpreadBinding,
    childNodeBinding: Binding<TChildNodeValue>,
  ) {
    this._part = part;
    this._directive = directive;
    this._spreadBinding = spreadBinding;
    this._childNodeBinding = childNodeBinding;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._flags & SlotBindingFlags.MOUNTED
      ? this._spreadBinding.part.node
      : this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): SlotDirective<TChildNodeValue> {
    return this._directive;
  }

  set value(newDirective: SlotDirective<TChildNodeValue>) {
    this._directive = newDirective;
  }

  init(updater: Updater): void {
    this._requestMutation(updater);
  }

  bind(updater: Updater): void {
    const { type, props, childNodeValue } = this._directive;
    const element = this._spreadBinding.part.node;

    if (element.nodeName !== type.toUpperCase()) {
      const elementPart = {
        type: 'element',
        node: document.createElement(this._directive.type),
      } as const;

      this._spreadBinding.disconnect();
      this._spreadBinding = new SpreadBinding(elementPart, props);
      this._spreadBinding.bind(updater);

      this._requestMutation(updater);
      this._flags |= SlotBindingFlags.REPARENTING;
    } else {
      this._spreadBinding.value = props;
      this._spreadBinding.bind(updater);

      if (!(this._flags & SlotBindingFlags.MOUNTED)) {
        this._requestMutation(updater);
      }
    }

    this._childNodeBinding = updateBinding(
      this._childNodeBinding,
      childNodeValue,
      updater,
    );

    this._flags &= ~SlotBindingFlags.UNMOUNTING;
  }

  unbind(updater: Updater) {
    this._requestMutation(updater);
    this._flags |= SlotBindingFlags.UNMOUNTING;
  }

  disconnect(): void {
    this._spreadBinding.disconnect();
    this._childNodeBinding.disconnect();
  }

  commit(): void {
    if (this._flags & SlotBindingFlags.UNMOUNTING) {
      const element = this._spreadBinding.part.node;

      element.remove();

      this._flags &= ~SlotBindingFlags.MOUNTED;
    } else {
      if (this._flags & SlotBindingFlags.REPARENTING) {
        const oldElement = this._childNodeBinding.part.node
          .parentNode as Element | null;
        const newElement = this._spreadBinding.part.node as Element;

        if (oldElement !== null) {
          newElement.replaceChildren(...oldElement.childNodes);
          oldElement.replaceWith(newElement);
        }
      } else {
        const element = this._spreadBinding.part.node;
        const reference = this._part.node;

        reference.before(element);
      }

      this._flags |= SlotBindingFlags.MOUNTED;
    }

    this._flags &= ~(
      SlotBindingFlags.MUTATING |
      SlotBindingFlags.UNMOUNTING |
      SlotBindingFlags.REPARENTING
    );
  }

  private _requestMutation(updater: Updater) {
    if (!(this._flags & SlotBindingFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= SlotBindingFlags.MUTATING;
    }
  }
}
