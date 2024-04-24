import {
  Binding,
  Directive,
  Part,
  Updater,
  directiveTag,
} from '../src/types.js';

export class MockDirective implements Directive {
  [directiveTag](part: Part, _updater: Updater): MockBinding {
    return new MockBinding(this, part);
  }
}

export class MockBinding implements Binding<MockDirective> {
  private readonly _part: Part;

  private _directive: MockDirective;

  constructor(directive: MockDirective, part: Part) {
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

  set value(newValue: MockDirective) {
    this._directive = newValue;
  }

  get value(): MockDirective {
    return this._directive;
  }

  bind(_updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}
