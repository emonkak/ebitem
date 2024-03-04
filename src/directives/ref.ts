import type { Ref } from '../hook.js';
import {
  Binding,
  Directive,
  ElementPart,
  Part,
  directiveTag,
} from '../part.js';
import type { Effect, Updater } from '../updater.js';

type ElementRef = Ref<Element | null>;

export function ref(ref: Ref<Element | null>): RefDirective {
  return new RefDirective(ref);
}

export class RefDirective implements Directive<ElementRef> {
  private readonly _ref: ElementRef;

  constructor(ref: ElementRef) {
    this._ref = ref;
  }

  [directiveTag](part: Part, updater: Updater): RefBinding {
    if (part.type !== 'element') {
      throw new Error(`${this.constructor.name} must be used in SpreadPart.`);
    }

    const binding = new RefBinding(part);

    binding.bind(this._ref, updater);

    return binding;
  }

  valueOf(): ElementRef {
    return this._ref;
  }
}

export class RefBinding implements Binding<ElementRef>, Effect {
  private readonly _part: ElementPart;

  private _pendingRef: ElementRef | null = null;

  private _memoizedRef: ElementRef | null = null;

  private _dirty = false;

  constructor(part: ElementPart) {
    this._part = part;
  }

  get part(): ElementPart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(ref: ElementRef, updater: Updater): void {
    this._pendingRef = ref;

    if (!this._dirty) {
      updater.enqueuePassiveEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    this._pendingRef = null;

    if (!this._dirty) {
      updater.enqueuePassiveEffect(this);
      this._dirty = true;
    }
  }

  disconnect() {}

  commit(): void {
    if (this._memoizedRef !== null) {
      const oldRef = this._memoizedRef;

      if (typeof oldRef === 'function') {
        oldRef(null);
      } else {
        oldRef.current = null;
      }
    }

    if (this._pendingRef !== null) {
      const newRef = this._pendingRef;

      if (typeof newRef === 'function') {
        newRef(this._part.node);
      } else {
        newRef.current = this._part.node;
      }
    }

    this._memoizedRef = this._pendingRef;
  }
}
