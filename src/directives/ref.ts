import { Binding, Directive, directiveTag } from '../binding.js';
import {
  AttributePart,
  Effect,
  Part,
  PartType,
  Ref,
  Updater,
} from '../types.js';

type ElementRef = Ref<Element | null>;

export function ref(ref: ElementRef | null): RefDirective {
  return new RefDirective(ref);
}

export class RefDirective implements Directive {
  private readonly _ref: ElementRef | null;

  constructor(ref: ElementRef | null) {
    this._ref = ref;
  }

  get ref(): ElementRef | null {
    return this._ref;
  }

  [directiveTag](part: Part, updater: Updater): RefBinding {
    if (part.type !== PartType.ATTRIBUTE || part.name !== 'ref') {
      throw new Error(
        `${this.constructor.name} must be used in "ref" attribute.`,
      );
    }

    const binding = new RefBinding(part, this);

    binding.bind(updater);

    return binding;
  }
}

export class RefBinding implements Binding<RefDirective>, Effect {
  private readonly _part: AttributePart;

  private _pendingDirective: RefDirective;

  private _memoizedDirective: RefDirective | null = null;

  private _dirty = false;

  constructor(part: AttributePart, directive: RefDirective) {
    this._part = part;
    this._pendingDirective = directive;
  }

  get part(): AttributePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): RefDirective {
    return this._pendingDirective;
  }

  set value(newDirective: RefDirective) {
    this._pendingDirective = newDirective;
  }

  bind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueuePassiveEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    this._pendingDirective = new RefDirective(null);

    if (!this._dirty) {
      updater.enqueuePassiveEffect(this);
      this._dirty = true;
    }
  }

  disconnect() {}

  commit(): void {
    const oldRef = this._memoizedDirective?.ref ?? null;
    const newRef = this._pendingDirective.ref;

    if (oldRef !== null) {
      if (typeof oldRef === 'function') {
        oldRef(null);
      } else {
        oldRef.current = null;
      }
    }

    if (newRef !== null) {
      if (typeof newRef === 'function') {
        newRef(this._part.node);
      } else {
        newRef.current = this._part.node;
      }

      this._memoizedDirective = this._pendingDirective;
    }
  }
}
