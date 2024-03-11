import { Binding, Directive, directiveTag } from '../binding.js';
import type { Part, Updater } from '../types.js';

export class UnitDirective implements Directive {
  constructor() {
    throw new Error(
      `${this.constructor.name} constructor cannot be called directly.`,
    );
  }

  [directiveTag](part: Part, _updater: Updater): UnitBinding {
    return new UnitBinding(part, this);
  }
}

export const unit: UnitDirective = Object.create(UnitDirective.prototype);

export class UnitBinding implements Binding<UnitDirective> {
  private readonly _part: Part;

  private _directive: UnitDirective;

  constructor(part: Part, directive: UnitDirective) {
    this._part = part;
    this._directive = directive;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): UnitDirective {
    return this._directive;
  }

  set value(newDirective: UnitDirective) {
    this._directive = newDirective;
  }

  bind(_updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}
