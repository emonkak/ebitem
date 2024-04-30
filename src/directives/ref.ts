import {
  AttributePart,
  Binding,
  Directive,
  Effect,
  Part,
  PartType,
  Ref,
  Updater,
  directiveTag,
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
    if (part.type !== PartType.Attribute || part.name !== 'ref') {
      throw new Error('RefDirective must be used in "ref" attribute.');
    }

    const binding = new RefBinding(this, part);

    binding.bind(updater);

    return binding;
  }
}

export class RefBinding implements Binding<RefDirective>, Effect {
  private readonly _part: AttributePart;

  private _pendingDirective: RefDirective;

  private _memoizedDirective = new RefDirective(null);

  private _dirty = false;

  constructor(directive: RefDirective, part: AttributePart) {
    this._pendingDirective = directive;
    this._part = part;
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

  set value(newValue: RefDirective) {
    this._pendingDirective = newValue;
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
    const oldRef = this._memoizedDirective.ref;
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
