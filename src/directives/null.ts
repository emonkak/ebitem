import { Binding, Directive, directiveTag } from '../binding.js';
import type { Part, Updater } from '../types.js';

export class NullDirective implements Directive<NullDirective> {
  static instance = new NullDirective();

  [directiveTag](part: Part, _updater: Updater): NullBinding {
    return new NullBinding(part, this);
  }
}

export class NullBinding implements Binding<NullDirective> {
  private readonly _part: Part;

  private _directive: NullDirective;

  constructor(part: Part, directive: NullDirective) {
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

  get value(): NullDirective {
    return this._directive;
  }

  set value(newDirective: NullDirective) {
    this._directive = newDirective;
  }

  bind(_updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}
