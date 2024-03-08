import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  createBinding,
  directiveTag,
  updateBinding,
} from '../part.js';
import { Effect, Updater } from '../updater.js';

export function slot<TElementValue, TChildNodeValue>(
  type: string,
  elementValue: TElementValue,
  childNodeValue: TChildNodeValue,
): SlotDirective<TElementValue, TChildNodeValue> {
  return new SlotDirective(type, elementValue, childNodeValue);
}

export class SlotDirective<TElementValue, TChildNodeValue>
  implements Directive<SlotDirective<TElementValue, TChildNodeValue>>
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
  ): SlotBinding<TElementValue, TChildNodeValue> {
    if (part.type !== 'childNode') {
      throw new Error(
        `${this.constructor.name} must be used in ChildNodePart.`,
      );
    }

    const element = document.createElement(this._type);
    const childMarker = document.createComment('');

    element.appendChild(childMarker);

    const elementPart = { type: 'element', node: element } as const;
    const elementBinding = createBinding(
      elementPart,
      this._elementValue,
      updater,
    );
    const childNodePart = { type: 'childNode', node: childMarker } as const;
    const childNodeBinding = createBinding(
      childNodePart,
      this._childNodeValue,
      updater,
    );

    const binding = new SlotBinding(
      part,
      this,
      elementBinding,
      childNodeBinding,
    );

    binding.init(updater);

    return binding;
  }
}

const SlotBindingFlags = {
  NONE: 0,
  DIRTY: 1 << 0,
  MOUNTING: 1 << 1,
  UNMOUNTING: 1 << 2,
  REPARENTING: 1 << 3,
  MOUNTED: 1 << 4,
};

export class SlotBinding<TElementValue, TChildNodeValue>
  implements Binding<SlotDirective<TElementValue, TChildNodeValue>>, Effect
{
  private readonly _part: ChildNodePart;

  private _directive: SlotDirective<TElementValue, TChildNodeValue>;

  private _elementBinding: Binding<TElementValue>;

  private _childNodeBinding: Binding<TChildNodeValue>;

  private _flags = SlotBindingFlags.NONE;

  constructor(
    part: ChildNodePart,
    directive: SlotDirective<TElementValue, TChildNodeValue>,
    elementBinding: Binding<TElementValue>,
    childNodeBinding: Binding<TChildNodeValue>,
  ) {
    this._part = part;
    this._directive = directive;
    this._elementBinding = elementBinding;
    this._childNodeBinding = childNodeBinding;
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

  get value(): SlotDirective<TElementValue, TChildNodeValue> {
    return this._directive;
  }

  set value(newDirective: SlotDirective<TElementValue, TChildNodeValue>) {
    this._directive = newDirective;
  }

  init(updater: Updater): void {
    this._requestMutation(updater);
    this._flags |= SlotBindingFlags.MOUNTING;
  }

  bind(updater: Updater): void {
    const { type, elementValue, childNodeValue } = this._directive;
    const element = this._elementBinding.part.node;

    if (element.nodeName !== type.toUpperCase()) {
      const elementPart = {
        type: 'element',
        node: document.createElement(this._directive.type),
      } as const;

      this._elementBinding.disconnect();
      this._elementBinding = createBinding(elementPart, elementValue, updater);

      this._requestMutation(updater);
      this._flags |= SlotBindingFlags.REPARENTING | SlotBindingFlags.MOUNTING;
    } else {
      this._elementBinding = updateBinding(
        this._elementBinding,
        elementValue,
        updater,
      );

      if (!(this._flags & SlotBindingFlags.MOUNTED)) {
        this._requestMutation(updater);
        this._flags |= SlotBindingFlags.MOUNTING;
      }
    }

    this._childNodeBinding = updateBinding(
      this._childNodeBinding,
      childNodeValue,
      updater,
    );
  }

  unbind(updater: Updater) {
    this._requestMutation(updater);
    this._flags |= SlotBindingFlags.UNMOUNTING;
  }

  disconnect(): void {
    this._elementBinding.disconnect();
    this._childNodeBinding.disconnect();
  }

  commit(): void {
    if (this._flags & SlotBindingFlags.REPARENTING) {
      const oldElement = this._childNodeBinding.part.node.parentNode as Element;
      const newElement = this._elementBinding.part.node as Element;

      newElement.replaceChildren(...oldElement.childNodes);
      oldElement.replaceWith(newElement);
    }

    if (this._flags & SlotBindingFlags.UNMOUNTING) {
      const element = this._elementBinding.part.node;

      element.remove();

      this._flags &= ~SlotBindingFlags.MOUNTED;
    } else {
      if (this._flags & SlotBindingFlags.MOUNTING) {
        const element = this._elementBinding.part.node;
        const reference = this._part.node;

        reference.before(element);

        this._flags |= SlotBindingFlags.MOUNTED;
      }
    }

    this._flags &= ~(
      SlotBindingFlags.DIRTY |
      SlotBindingFlags.MOUNTING |
      SlotBindingFlags.UNMOUNTING |
      SlotBindingFlags.REPARENTING
    );
  }

  private _requestMutation(updater: Updater) {
    if (!(this._flags & SlotBindingFlags.DIRTY)) {
      updater.enqueueMutationEffect(this);
      this._flags |= SlotBindingFlags.DIRTY;
    }
  }
}
