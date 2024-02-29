import { Directive, directiveSymbol } from '../directive.js';
import { Part, mountPart, updatePart } from '../part.js';
import { ChildPart, ChildValue } from '../part/child.js';
import { ElementPart, SpreadProps } from '../part/element.js';
import type { Updater } from '../updater.js';

export function slot(type: string, props: SpreadProps, value: unknown): Slot {
  return new Slot(type, props, value);
}

export class Slot implements Directive {
  private readonly _type: string;

  private readonly _props: SpreadProps;

  private readonly _value: unknown;

  constructor(type: string, props: SpreadProps, value: unknown) {
    this._type = type;
    this._props = props;
    this._value = value;
  }

  [directiveSymbol](part: Part, updater: Updater): void {
    if (!(part instanceof ChildPart)) {
      throw new Error('Slot directive must be used in an arbitrary child.');
    }

    const value = part.value;

    if (value instanceof SlotChild && value.type === this._type) {
      value.update(this._props, this._value, updater);
    } else {
      const newSlot = new SlotChild(
        this._type,
        this._props,
        this._value,
        updater,
      );

      part.setValue(newSlot, updater);

      updater.enqueueMutationEffect(part);
      updater.requestUpdate();
    }
  }
}

export class SlotChild<TContext> extends ChildValue {
  private readonly _element: Element;

  private readonly _elementPart: ElementPart;

  private readonly _childPart: ChildPart;

  private _memoizedProps: SpreadProps;

  private _memoizedValue: unknown;

  constructor(
    type: string,
    props: SpreadProps,
    value: unknown,
    updater: Updater,
  ) {
    super();

    const element = document.createElement(type);
    const marker = document.createComment('');
    const childPart = new ChildPart(marker);
    const elementPart = new ElementPart(element);

    element.appendChild(marker);

    mountPart(elementPart, props, updater);
    mountPart(childPart, value, updater);

    this._element = element;
    this._elementPart = elementPart;
    this._childPart = childPart;
    this._memoizedProps = props;
    this._memoizedValue = value;
  }

  get endNode(): ChildNode | null {
    return this._element;
  }

  get props(): SpreadProps {
    return this._memoizedProps;
  }

  get startNode(): ChildNode | null {
    return this._element;
  }

  get type(): string {
    return this._element.tagName;
  }

  get value(): unknown {
    return this._memoizedValue;
  }

  update(
    newProps: SpreadProps,
    newValue: unknown,
    updater: Updater<TContext>,
  ): void {
    updatePart(this._elementPart, this._memoizedProps, newProps, updater);
    updatePart(this._childPart, this._memoizedValue, newValue, updater);
    this._memoizedProps = newProps;
    this._memoizedValue = newValue;
  }

  onMount(part: ChildPart, _updater: Updater): void {
    const reference = part.endNode;
    reference.parentNode!.insertBefore(this._element, part.endNode);
  }

  onUnmount(_part: ChildPart, updater: Updater): void {
    this._childPart.disconnect(updater);
    this._elementPart.disconnect(updater);
    this._element.remove();
  }

  onUpdate(_part: ChildPart, _updater: Updater): void {}
}
