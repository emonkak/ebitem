import { Binding, Directive, directiveTag } from '../binding.js';
import type { Part, Updater } from '../types.js';

function NullDirective() {
  throw new Error('NullDirective constructor cannot be called directly.');
}

NullDirective.prototype = {
  [directiveTag](part: Part, _updater: Updater): NullBinding {
    return new NullBinding(part, this);
  },
};

export const nullDirective: Directive = Object.create(NullDirective.prototype);

export class NullBinding implements Binding<typeof nullDirective> {
  private readonly _part: Part;

  private _directive: typeof nullDirective;

  constructor(part: Part, directive: typeof nullDirective) {
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

  get value(): typeof nullDirective {
    return this._directive;
  }

  set value(newDirective: typeof nullDirective) {
    this._directive = newDirective;
  }

  bind(_updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}
