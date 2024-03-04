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

const SlotFlags = {
  NONE: 0,
  MUTATING: 1 << 0,
  UNMOUNTING: 1 << 1,
  REPARENTING: 1 << 2,
  DISCONNECTING: 1 << 3,
  MOUNTED: 1 << 4,
};

export function slot<TElementValue, TChildValue>(
  type: string,
  elementValue: TElementValue,
  childValue: TChildValue,
): SlotDirective<TElementValue, TChildValue> {
  return new SlotDirective(type, elementValue, childValue);
}

interface Slot<TElementValue, TChildValue> {
  elementBinding: Binding<BindValueOf<TElementValue>>;
  childNodeBinding: Binding<BindValueOf<TChildValue>>;
  elementValue: TElementValue;
  childValue: TChildValue;
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
  implements Binding<SlotDirective<TElementValue, TChildValue>>, Effect
{
  private readonly _part: ChildNodePart;

  private _slot: Slot<TElementValue, TChildValue> | null = null;

  private _flags = SlotFlags.NONE;

  constructor(part: ChildNodePart) {
    this._part = part;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._flags & SlotFlags.MOUNTED
      ? this._slot?.elementBinding.part.node ?? this._part.node
      : this._part.node;
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
      const {
        elementBinding,
        childNodeBinding,
        elementValue: oldElementValue,
        childValue: oldChildValue,
      } = this._slot;

      if (elementBinding.part.node.nodeName !== type.toUpperCase()) {
        const elementPart = {
          type: 'element',
          node: document.createElement(type),
        } as const;
        const newElementBinding = createBinding(
          elementPart,
          elementValue,
          updater,
        );

        if (!(this._flags & SlotFlags.MUTATING)) {
          updater.enqueueMutationEffect(this);
        }

        updater.enqueuePassiveEffect(new Disconnect(elementBinding));

        this._slot.elementBinding = newElementBinding;
        this._flags |= SlotFlags.MUTATING | SlotFlags.REPARENTING;
      } else {
        this._slot.elementBinding = checkAndUpdateBinding(
          elementBinding,
          oldElementValue,
          elementValue,
          updater,
        );
      }

      this._slot.childNodeBinding = checkAndUpdateBinding(
        childNodeBinding,
        oldChildValue,
        childValue,
        updater,
      );
      this._slot.elementValue = elementValue;
      this._slot.childValue = childValue;
    } else {
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

      const newElementBinding = createBinding(
        elementPart,
        elementValue,
        updater,
      );
      const newChildNodeBinding = createBinding(
        childNodePart,
        childValue,
        updater,
      );

      this._slot = {
        elementBinding: newElementBinding,
        childNodeBinding: newChildNodeBinding,
        elementValue,
        childValue,
      };

      if (!(this._flags & SlotFlags.MOUNTED)) {
        if (!(this._flags & SlotFlags.MUTATING)) {
          updater.enqueueMutationEffect(this);
        }
        this._flags |= SlotFlags.MUTATING;
      }
    }
  }

  unbind(updater: Updater) {
    if (this._flags & SlotFlags.MOUNTED) {
      if (!(this._flags & SlotFlags.MUTATING)) {
        updater.enqueueMutationEffect(this);
      }
      this._flags |= SlotFlags.MUTATING | SlotFlags.UNMOUNTING;
    }

    if (!(this._flags & SlotFlags.DISCONNECTING)) {
      updater.enqueuePassiveEffect(this);
      this._flags |= SlotFlags.DISCONNECTING;
    }
  }

  disconnect(): void {
    if (this._slot !== null) {
      const { elementBinding, childNodeBinding } = this._slot;

      elementBinding?.disconnect();
      childNodeBinding?.disconnect();
    }
  }

  commit(mode: CommitMode): void {
    switch (mode) {
      case 'mutation': {
        if (this._flags & SlotFlags.MOUNTED) {
          if (this._flags & SlotFlags.REPARENTING) {
            const { elementBinding, childNodeBinding } = this._slot!;
            const oldElement = childNodeBinding.part.node
              .parentNode as Element | null;
            const newElement = elementBinding.part.node as Element;

            if (oldElement !== null && oldElement !== newElement) {
              newElement.replaceChildren(...oldElement.childNodes);
              oldElement.replaceWith(newElement);
            }
          }

          if (this._flags & SlotFlags.UNMOUNTING) {
            const { elementBinding } = this._slot!;
            const element = elementBinding.part.node;

            element.remove();

            this._flags &= ~SlotFlags.MOUNTED;
          }
        } else {
          const { elementBinding } = this._slot!;
          const element = elementBinding.part.node;
          const reference = this._part.node;

          reference.before(element);

          this._flags |= SlotFlags.MOUNTED;
        }

        this._flags &= ~(
          SlotFlags.MUTATING |
          SlotFlags.REPARENTING |
          SlotFlags.UNMOUNTING
        );
        break;
      }
      case 'passive': {
        const { elementBinding, childNodeBinding } = this._slot!;

        elementBinding!.disconnect();
        childNodeBinding!.disconnect();

        this._flags &= ~SlotFlags.DISCONNECTING;
        break;
      }
    }
  }
}
