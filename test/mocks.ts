import { Binding, Directive, directiveTag } from '../src/binding.js';
import { Part } from '../src/part.js';
import { TaskPriority } from '../src/scheduler.js';
import type { Component, Scope, Updater } from '../src/types.js';

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

export class MockComponent<TContext> implements Component<TContext> {
  get dirty(): boolean {
    return false;
  }

  get parent(): Component<TContext> | null {
    return null;
  }

  get priority(): TaskPriority {
    return 'user-visible';
  }

  requestUpdate(_updater: Updater<TContext>, _priority: TaskPriority): void {}

  render(_scope: Scope<TContext>, _updater: Updater<TContext>): void {}
}
