import { Binding, Directive, Part, directiveTag } from '../src/binding.js';
import { Updater } from '../src/updater.js';

export class MockDirective implements Directive {
  [directiveTag](part: Part, _updater: Updater): MockBinding {
    return new MockBinding(this, part);
  }
}

export class MockBinding implements Binding<MockDirective> {
  private readonly _part: Part;

  private _value: MockDirective;

  constructor(value: MockDirective, part: Part) {
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

  set value(newValue: MockDirective) {
    this._value = newValue;
  }

  get value(): MockDirective {
    return this._value;
  }

  bind(_updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}
