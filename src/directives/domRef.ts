import type { Context } from '../context';
import { Directive, directiveSymbol } from '../directive';
import { AttributePart } from '../part';
import type { Part, Ref, RefCallback } from '../types';

export class DOMRef implements Directive {
  private readonly _ref: Ref<Element | null> | RefCallback<Node>;

  constructor(ref: Ref<Element | null>) {
    this._ref = ref;
  }

  [directiveSymbol](part: Part, _context: Context): void {
    if (!(part instanceof AttributePart) || part.attributeName !== 'ref') {
      throw new Error(
        '"DOMRef" directive must be used in the "ref" attribute.',
      );
    }

    if (typeof this._ref === 'function') {
      this._ref(part.node);
    } else {
      this._ref.current = part.node;
    }
  }
}

export function domRef(ref: Ref<Element | null>) {
  return new DOMRef(ref);
}
