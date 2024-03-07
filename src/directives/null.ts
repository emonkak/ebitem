import { Binding, Directive, Part, directiveTag } from '../part.js';
import type { Updater } from '../updater.js';

export class NullDirective implements Directive<NullDirective> {
  [directiveTag](part: Part, _updater: Updater): NullBinding {
    return new NullBinding(part);
  }

  valueOf(): this {
    return this;
  }
}

export class NullBinding implements Binding<NullDirective> {
  private readonly _part: Part;

  constructor(part: Part) {
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

  bind(_value: NullDirective, _updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}
