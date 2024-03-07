import {
  BindValueOf,
  Binding,
  ChildNodePart,
  Directive,
  Part,
  checkAndUpdateBinding,
  createBinding,
  directiveTag,
} from '../part.js';
import { CommitMode, Disconnect, Effect, Updater } from '../updater.js';

export function slot<TElementValue, TChildValue>(
  type: string,
  elementValue: TElementValue,
  childValue: TChildValue,
): SlotDirective<TElementValue, TChildValue> {
  return new SlotDirective(type, elementValue, childValue);
}

export class SlotDirective<TElementValue, TChildValue>
  implements Directive<SlotDirective<TElementValue, TChildValue>>
{
  private readonly _type: string;

  private readonly _elementValue: TElementValue;

  private readonly _childValue: TChildValue;

  constructor(
    type: string,
    elementValue: TElementValue,
    childValue: TChildValue,
  ) {
    this._type = type;
    this._elementValue = elementValue;
    this._childValue = childValue;
  }

  get type(): string {
    return this._type;
  }

  get elementValue(): TElementValue {
    return this._elementValue;
  }

  get childValue(): TChildValue {
    return this._childValue;
  }

  [directiveTag](
    part: Part,
    updater: Updater,
  ): SlotBinding<TElementValue, TChildValue> {
    if (part.type !== 'childNode') {
      throw new Error(
        `${this.constructor.name} must be used in ChildNodePart.`,
      );
    }

    const binding = new SlotBinding<TElementValue, TChildValue>(part);

    binding.bind(this, updater);

    return binding;
  }

  valueOf(): this {
    return this;
  }
}

export class SlotBinding<TElementValue, TChildValue>
  implements Binding<SlotDirective<TElementValue, TChildValue>>
{
  private readonly _part: ChildNodePart;

  private _slot: Slot<TElementValue, TChildValue> | null = null;

  constructor(part: ChildNodePart) {
    this._part = part;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._slot?.node ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(
    {
      type,
      elementValue,
      childValue,
    }: SlotDirective<TElementValue, TChildValue>,
    updater: Updater,
  ): void {
    if (this._slot !== null) {
      this._slot.update(type, elementValue, childValue, updater);
    } else {
      const newSlot = Slot.create(
        type,
        elementValue,
        childValue,
        this._part,
        updater,
      );
      newSlot.forceMount(updater);
      this._slot = newSlot;
    }
  }

  unbind(updater: Updater) {
    this._slot?.forceUnmount(updater);
  }

  disconnect(): void {
    this._slot?.disconnect();
  }
}

const SlotFlags = {
  NONE: 0,
  MUTATING: 1 << 0,
  UNMOUNTING: 1 << 1,
  REPARENTING: 1 << 2,
  MOUNTED: 1 << 3,
};

class Slot<TElementValue, TChildValue> implements Effect {
  private readonly _part: ChildNodePart;

  private _elementBinding: Binding<BindValueOf<TElementValue>>;

  private _childNodeBinding: Binding<BindValueOf<TChildValue>>;

  private _type: string;

  private _elementValue: TElementValue;

  private _childValue: TChildValue;

  private _flags = SlotFlags.NONE;

  static create<TElementValue, TChildValue>(
    type: string,
    elementValue: TElementValue,
    childValue: TChildValue,
    part: ChildNodePart,
    updater: Updater,
  ): Slot<TElementValue, TChildValue> {
    const element = document.createElement(type);
    const childMarker = document.createComment('');

    element.appendChild(childMarker);

    const elementPart = {
      type: 'element',
      node: element,
    } as const;
    const childNodePart = {
      type: 'childNode',
      node: childMarker,
    } as const;

    const elementBinding = createBinding(elementPart, elementValue, updater);
    const childNodeBinding = createBinding(childNodePart, childValue, updater);

    return new Slot(
      elementBinding,
      childNodeBinding,
      part,
      type,
      elementValue,
      childValue,
    );
  }

  constructor(
    elementBinding: Binding<BindValueOf<TElementValue>>,
    childNodeBinding: Binding<BindValueOf<TChildValue>>,
    part: ChildNodePart,
    type: string,
    elementValue: TElementValue,
    childValue: TChildValue,
  ) {
    this._elementBinding = elementBinding;
    this._childNodeBinding = childNodeBinding;
    this._part = part;
    this._type = type;
    this._elementValue = elementValue;
    this._childValue = childValue;
  }

  get node(): ChildNode {
    return this._elementBinding.part.node;
  }

  get isMounted(): boolean {
    return !!(this._flags & SlotFlags.MOUNTED);
  }

  forceMount(updater: Updater) {
    if (!(this._flags & SlotFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= SlotFlags.MUTATING;
    }

    this._flags &= ~SlotFlags.UNMOUNTING;
  }

  forceUnmount(updater: Updater) {
    if (!(this._flags & SlotFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= SlotFlags.MUTATING;
    }

    this._flags |= SlotFlags.UNMOUNTING;
  }

  update(
    newType: string,
    newElementValue: TElementValue,
    newChildValue: TChildValue,
    updater: Updater,
  ): void {
    if (this._type !== newType) {
      const elementPart = {
        type: 'element',
        node: document.createElement(newType),
      } as const;
      const newElementBinding = createBinding(
        elementPart,
        newElementValue,
        updater,
      );

      if (!(this._flags & SlotFlags.MUTATING)) {
        updater.enqueueMutationEffect(this);
        this._flags |= SlotFlags.MUTATING;
      }

      updater.enqueuePassiveEffect(new Disconnect(this._elementBinding));

      this._elementBinding = newElementBinding;
      this._flags |= SlotFlags.REPARENTING;
    } else {
      this._elementBinding = checkAndUpdateBinding(
        this._elementBinding,
        this._elementValue,
        newElementValue,
        updater,
      );
    }

    this._childNodeBinding = checkAndUpdateBinding(
      this._childNodeBinding,
      this._childValue,
      newChildValue,
      updater,
    );

    this._type = newType;
    this._elementValue = newElementValue;
    this._childValue = newChildValue;
  }

  commit(_mode: CommitMode, updater: Updater): void {
    if (this._flags & SlotFlags.MOUNTED) {
      if (this._flags & SlotFlags.REPARENTING) {
        const oldElement = this._childNodeBinding.part.node
          .parentNode as Element | null;
        const newElement = this._elementBinding.part.node as Element;

        if (oldElement !== null && oldElement !== newElement) {
          newElement.replaceChildren(...oldElement.childNodes);
          oldElement.replaceWith(newElement);
        }
      }

      if (this._flags & SlotFlags.UNMOUNTING) {
        const element = this._elementBinding.part.node;

        element.remove();

        updater.enqueuePassiveEffect(new Disconnect(this._elementBinding));
        updater.enqueuePassiveEffect(new Disconnect(this._childNodeBinding));

        this._flags &= ~SlotFlags.MOUNTED;
      }
    } else {
      if (!(this._flags & SlotFlags.UNMOUNTING)) {
        const element = this._elementBinding.part.node;
        const reference = this._part.node;

        reference.before(element);

        this._flags |= SlotFlags.MOUNTED;
      }
    }

    this._flags &= ~(SlotFlags.MUTATING | SlotFlags.REPARENTING);
  }

  disconnect(): void {
    this._elementBinding.disconnect();
    this._childNodeBinding.disconnect();
  }
}
