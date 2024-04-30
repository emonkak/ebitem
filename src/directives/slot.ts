import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  PartType,
  SpreadBinding,
  SpreadProps,
  directiveTag,
  initializeBinding,
  updateBinding,
} from '../binding.js';
import type { Effect, Updater } from '../updater.js';

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
    if (part.type !== PartType.ChildNode) {
      throw new Error('SlotDirective must be used in ChildNodePart.');
    }

    return new SlotBinding(this, part, updater);
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

  private _elementBinding: SpreadBinding;

  private _childNodeBinding: Binding<TChildNodeValue>;

  private _flags = SlotBindingFlags.NONE;

  constructor(
    directive: SlotDirective<TChildNodeValue>,
    part: ChildNodePart,
    updater: Updater,
  ) {
    const element = document.createElement(directive.type);
    const childMarker = document.createComment('');

    element.appendChild(childMarker);

    const elementPart = { type: PartType.Element, node: element } as const;
    const elementBinding = new SpreadBinding(directive.props, elementPart);

    elementBinding.bind(updater);

    const childNodePart = {
      type: PartType.ChildNode,
      node: childMarker,
    } as const;
    const childNodeBinding = initializeBinding(
      directive.childNodeValue,
      childNodePart,
      updater,
    );

    this._directive = directive;
    this._elementBinding = elementBinding;
    this._childNodeBinding = childNodeBinding;
    this._part = part;

    this._requestMutation(updater);
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._flags & SlotBindingFlags.MOUNTED
      ? this._elementBinding.part.node
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
      this._flags |= SlotBindingFlags.REPARENTING;
    } else {
      this._elementBinding.value = props;
      this._elementBinding.bind(updater);

      if (!(this._flags & SlotBindingFlags.MOUNTED)) {
        this._requestMutation(updater);
      }
    }

    if (Object.is(this._childNodeBinding.value, childNodeValue)) {
      this._childNodeBinding = updateBinding(
        this._childNodeBinding,
        childNodeValue,
        updater,
      );
    }

    this._flags &= ~SlotBindingFlags.UNMOUNTING;
  }

  unbind(updater: Updater): void {
    this._requestMutation(updater);
    this._flags |= SlotBindingFlags.UNMOUNTING;
  }

  disconnect(): void {
    this._elementBinding.disconnect();
    this._childNodeBinding.disconnect();
  }

  commit(): void {
    if (this._flags & SlotBindingFlags.UNMOUNTING) {
      const element = this._elementBinding.part.node;

      element.remove();

      this._flags &= ~SlotBindingFlags.MOUNTED;
    } else {
      const element = this._elementBinding.part.node as Element;
      const referenceNode = this._part.node;

      if (this._flags & SlotBindingFlags.REPARENTING) {
        const oldElement = this._childNodeBinding.part.node
          .parentNode as Element | null;
        if (oldElement !== null) {
          element.replaceChildren(...oldElement.childNodes);
        }
      }

      referenceNode.before(element);

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
