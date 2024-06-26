import { type Binding, type Directive, directiveTag } from '../src/binding.js';
import type {
  ChildNodePart,
  Component,
  Part,
  TaskPriority,
  Template,
  TemplateFragment,
  TemplateResult,
  UpdateContext,
  Updater,
} from '../src/types.js';

export class MockDirective implements Directive {
  [directiveTag](part: Part, _updater: Updater): MockBinding {
    return new MockBinding(this, part);
  }
}

export class MockBinding implements Binding<MockDirective> {
  private _value: MockDirective;

  private readonly _part: Part;

  constructor(value: MockDirective, part: Part) {
    this._value = value;
    this._part = part;
  }

  get value(): MockDirective {
    return this._value;
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

  bind(newValue: MockDirective, _updater: Updater): void {
    this._value = newValue;
  }

  connect(_updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}

export class MockComponent<TContext> implements Component<TContext> {
  private _parent: Component<TContext> | null;

  constructor(parent: Component<TContext> | null = null) {
    this._parent = parent;
  }

  get dirty(): boolean {
    return false;
  }

  get parent(): Component<TContext> | null {
    return this._parent;
  }

  get priority(): TaskPriority {
    return 'user-visible';
  }

  shouldUpdate(): boolean {
    return true;
  }

  requestUpdate(_priority: TaskPriority, _updater: Updater<TContext>): void {}

  update(
    _context: UpdateContext<TContext>,
    _updater: Updater<TContext>,
  ): void {}
}

export class MockTemplate<TData, TContext>
  implements Template<TData, TContext>
{
  hydrate(
    _data: TData,
    _updater: Updater<TContext>,
  ): MockTemplateFragment<TData, TContext> {
    return new MockTemplateFragment();
  }

  isSameTemplate(other: Template<TData, TContext>): boolean {
    return this === other;
  }
}

export class MockTemplateFragment<TData, TContext>
  implements TemplateFragment<TData, TContext>
{
  get startNode(): ChildNode | null {
    return null;
  }

  get endNode(): ChildNode | null {
    return null;
  }

  bind(_data: TData, _updater: Updater<TContext>): void {}

  unbind(_updater: Updater): void {}

  mount(_part: ChildNodePart): void {}

  unmount(_part: ChildNodePart): void {}

  disconnect(): void {}
}

export class MockTemplateResult<TData, TContext>
  implements TemplateResult<TData, TContext>
{
  private _template: Template<TData, TContext>;

  private _data: TData;

  constructor(template: Template<TData, TContext>, data: TData) {
    this._template = template;
    this._data = data;
  }

  get template(): Template<TData, TContext> {
    return this._template;
  }
  get data(): TData {
    return this._data;
  }
}
