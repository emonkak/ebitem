import { Binding, Directive, Part, directiveTag } from '../binding.js';
import type { Updater } from '../updater.js';

export class UnitDirective implements Directive {
  constructor() {
    throw new Error('UnitDirective constructor cannot be called directly.');
  }

  [directiveTag](part: Part, _updater: Updater): UnitBinding {
    return new UnitBinding(this, part);
  }
}

export const unit: UnitDirective = Object.create(UnitDirective.prototype);

export class UnitBinding implements Binding<UnitDirective> {
  private readonly _part: Part;

  private _directive: UnitDirective;

  constructor(directive: UnitDirective, part: Part) {
    this._directive = directive;
    this._part = part;
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
