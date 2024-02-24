import { Directive, directiveSymbol } from '../directive.js';
import { Part } from '../part.js';
import { ChildPart, SpreadProps } from '../parts.js';
import { Slot as SlotChild } from '../slot.js';
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
      throw new Error('"Slot" directive must be used in an arbitrary child.');
    }

    const value = part.value;

    if (value instanceof SlotChild && value.type === this._type) {
      value.setProps(this._props);
      value.setValue(this._value);
      value.forceUpdate(updater);
    } else {
      const newSlot = new SlotChild(
        this._type,
        this._props,
        this._value,
        updater.currentRenderable,
      );

      part.setValue(newSlot, updater);

      updater.enqueueRenderable(newSlot);
      updater.enqueueMutationEffect(part);
      updater.requestUpdate();
    }
  }
}
