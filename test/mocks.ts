import {
  Binding,
  Directive,
  Part,
  Updater,
  directiveTag,
} from '../src/types.js';

export class MockDirective<T> implements Directive {
  private readonly _value: T;

  constructor(value: T) {
    this._value = value;
  }

  get value(): T {
    return this._value;
  }

  [directiveTag](part: Part, _updater: Updater): MockBinding<T> {
    return new MockBinding(part, this);
  }
}

export class MockBinding<T> implements Binding<MockDirective<T>> {
  private readonly _part: Part;

  private _directive: MockDirective<T>;

  constructor(part: Part, directive: MockDirective<T>) {
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

  set value(newValue: MockDirective<T>) {
    this._directive = newValue;
  }

  get value(): MockDirective<T> {
    return this._directive;
  }

  bind(_updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}
