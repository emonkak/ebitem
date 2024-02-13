import { Directive, directiveSymbol } from '../directive.js';
import type { Ref } from '../hook.js';
import { Part } from '../part.js';
import { AttributePart, AttributeValue } from '../parts.js';
import type { Updater } from '../updater.js';

export function elementRef(ref: Ref<Element | null>) {
  return new ElementRef(ref);
}

export class ElementRef implements Directive {
  private readonly _ref: Ref<Element | null>;

  constructor(ref: Ref<Element | null>) {
    this._ref = ref;
  }

  [directiveSymbol](part: Part, updater: Updater): void {
    if (!(part instanceof AttributePart) || part.name !== 'ref') {
      throw new Error(
        '"ElementRef" directive must be used in the "ref" attribute.',
      );
    }

    if (!(part.value instanceof RefAttribute) || part.value.ref !== this._ref) {
      part.setValue(new RefAttribute(this._ref), updater);

      updater.pushMutationEffect(part);
    }
  }
}

export class RefAttribute extends AttributeValue {
  private readonly _ref: Ref<Element | null>;

  constructor(ref: Ref<Element | null>) {
    super();
    this._ref = ref;
  }

  get ref(): Ref<Element | null> {
    return this._ref;
  }

  mount(part: AttributePart, _updater: Updater): void {
    if (typeof this._ref === 'function') {
      this._ref(part.node);
    } else {
      this._ref.current = part.node;
    }
  }

  unmount(_part: AttributePart, _updater: Updater): void {
    if (typeof this._ref === 'function') {
      this._ref(null);
    } else {
      this._ref.current = null;
    }
  }

  update(_part: AttributePart, _updater: Updater): void {}
}
