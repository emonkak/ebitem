import { Directive, directiveSymbol } from '../directive';
import type { RefCallback, RefObject } from '../hook';
import { Part } from '../part';
import { AttributePart } from '../parts';
import type { Updater } from '../updater';

export class DOMRef implements Directive {
  private readonly _ref: RefCallback<Element> | RefObject<Element | null>;

  constructor(ref: RefCallback<Element> | RefObject<Element | null>) {
    this._ref = ref;
  }

  [directiveSymbol](part: Part, _updater: Updater): void {
    if (!(part instanceof AttributePart) || part.name !== 'ref') {
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
