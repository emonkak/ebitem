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

  private _value: UnitDirective;

  constructor(value: UnitDirective, part: Part) {
    this._value = value;
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
    return this._value;
  }

  set value(newValue: UnitDirective) {
    this._value = newValue;
  }

  bind(_updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}
