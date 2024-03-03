import { Directive, directiveTag } from '../directive.js';
import { Part } from '../part.js';
import { ChildPart } from '../part/child.js';
import type { ElementProps } from '../part/element.js';
import { Slot } from '../slot.js';
import type { Updater } from '../updater.js';

export function slot(
  type: string,
  props: ElementProps,
  value: unknown,
): SlotDirective {
  return new SlotDirective(type, props, value);
}

export class SlotDirective implements Directive<unknown> {
  private readonly _type: string;

  private readonly _elementProps: ElementProps;

  private readonly _childValue: unknown;

  constructor(type: string, elementProps: ElementProps, childValue: unknown) {
    this._type = type;
    this._elementProps = elementProps;
    this._childValue = childValue;
  }

  [directiveTag](_context: unknown, part: Part, updater: Updater): void {
    if (!(part instanceof ChildPart)) {
      throw new Error('Slot directive must be used in an arbitrary child.');
    }

    const slot = part.value;

    if (slot instanceof Slot && slot.type === this._type) {
      slot.updateParts(this._elementProps, this._childValue, updater);
    } else {
      const newSlot = new Slot(this._type);

      newSlot.connectParts(this._elementProps, this._childValue, updater);

      part.value = newSlot;

      updater.enqueueMutationEffect(part);
    }

    updater.requestUpdate();
  }
}
