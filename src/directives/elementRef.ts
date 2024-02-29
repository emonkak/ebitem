import { Directive, directiveSymbol } from '../directive.js';
import type { Ref } from '../hook.js';
import type { Part } from '../part.js';
import { ElementPart, ElementValue } from '../part/element.js';
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
    if (!(part instanceof ElementPart)) {
      throw new Error('ElementRef directive must be used in an element part.');
    }

    if (!(part.value instanceof RefElement) || part.value.ref !== this._ref) {
      part.setValue(new RefElement(this._ref), updater);

      updater.enqueueMutationEffect(part);
    }
  }
}

export class RefElement extends ElementValue {
  private readonly _ref: Ref<Element | null>;

  constructor(ref: Ref<Element | null>) {
    super();
    this._ref = ref;
  }

  get ref(): Ref<Element | null> {
    return this._ref;
  }

  onMount(part: ElementPart, _updater: Updater): void {
    if (typeof this._ref === 'function') {
      this._ref(part.node);
    } else {
      this._ref.current = part.node;
    }
  }

  onUnmount(_part: ElementPart, _updater: Updater): void {
    if (typeof this._ref === 'function') {
      this._ref(null);
    } else {
      this._ref.current = null;
    }
  }

  onUpdate(_part: ElementPart, _updater: Updater): void {}
}
