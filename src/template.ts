import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  PartType,
  directiveTag,
} from './binding.js';
import {
  LOWEST_PRIORITY,
  TaskPriority,
  isHigherPriority,
} from './scheduler.js';
import type { Scope } from './scope.js';
import type { Component, Effect, Updater } from './updater.js';

export interface Template<TData, TContext = unknown> {
  hydrate(
    data: TData,
    updater: Updater<TContext>,
  ): TemplateRoot<TData, TContext>;
  sameTemplate(other: Template<TData, TContext>): boolean;
}

export interface TemplateRoot<TData, TContext = unknown> {
  get startNode(): ChildNode | null;
  get endNode(): ChildNode | null;
  bindData(data: TData, updater: Updater<TContext>): void;
  unbindData(updater: Updater): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
  disconnect(): void;
}

const TemplateFlags = {
  NONE: 0,
  UPDATING: 1 << 0,
  MUTATING: 1 << 1,
  UNMOUNTING: 1 << 2,
};

export class TemplateDirective<TData, TContext = unknown>
  implements Directive<TContext>
{
  private readonly _template: Template<TData, TContext>;

  private readonly _data: TData;

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

  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): Binding<TemplateDirective<TData, TContext>, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error('TemplateDirective must be used in ChildNodePart.');
    }

    const binding = new TemplateBinding(this, part, updater.currentComponent);

    binding.bind(updater);

    return binding;
  }
}

export class TemplateBinding<TData, TContext>
  implements
    Binding<TemplateDirective<TData, TContext>, TContext>,
    Effect,
    Component<TContext>
{
  private readonly _part: ChildNodePart;

  private readonly _parent: Component<TContext> | null;

  private _value: TemplateDirective<TData, TContext>;

  private _memoizedRoot: TemplateRoot<TData, TContext> | null = null;

  private _pendingRoot: TemplateRoot<TData, TContext> | null = null;

  private _template: Template<TData, TContext> | null = null;

  private _priority: TaskPriority = LOWEST_PRIORITY;

  private _flags = TemplateFlags.NONE;

  constructor(
    value: TemplateDirective<TData, TContext>,
    part: ChildNodePart,
    parent: Component<TContext> | null = null,
  ) {
    this._value = value;
    this._part = part;
    this._parent = parent;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._memoizedRoot?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): TemplateDirective<TData, TContext> {
    return this._value;
  }

  get parent(): Component<TContext> | null {
    return this._parent;
  }

  get priority(): TaskPriority {
    return this._priority;
  }

  get dirty(): boolean {
    return !!(
      this._flags & TemplateFlags.UPDATING ||
      this._flags & TemplateFlags.UNMOUNTING
    );
  }

  set value(newValue: TemplateDirective<TData, TContext>) {
    this._value = newValue;
  }

  requestUpdate(updater: Updater<TContext>, priority: TaskPriority): void {
    if (
      !(this._flags & TemplateFlags.UPDATING) ||
      isHigherPriority(priority, this._priority)
    ) {
      this._priority = priority;
      this._flags |= TemplateFlags.UPDATING;
      updater.enqueueComponent(this);
      updater.scheduleUpdate();
    }

    this._flags &= ~TemplateFlags.UNMOUNTING;
  }

  bind(updater: Updater<TContext>): void {
    if (!(this._flags & TemplateFlags.UPDATING)) {
      this._priority = this._parent?.priority ?? updater.getCurrentPriority();
      this._flags |= TemplateFlags.UPDATING;
      updater.enqueueComponent(this);
    }

    this._flags &= ~TemplateFlags.UNMOUNTING;
  }

  unbind(updater: Updater<TContext>): void {
    this._pendingRoot?.unbindData(updater);

    if (this._memoizedRoot !== this._pendingRoot) {
      this._memoizedRoot?.unbindData(updater);
    }

    this._requestMutation(updater);

    this._pendingRoot = null;
    this._flags |= TemplateFlags.UNMOUNTING;
    this._flags &= ~TemplateFlags.UPDATING;
  }

  render(updater: Updater<TContext>, _scope: Scope<TContext>): void {
    const { template, data } = this._value;

    if (this._pendingRoot !== null) {
      if (this._template && this._template.sameTemplate(template)) {
        this._pendingRoot.bindData(data, updater);
      } else {
        this._pendingRoot.unbindData(updater);
        this._pendingRoot = null;
      }
    }

    if (this._pendingRoot === null) {
      this._requestMutation(updater);
      this._pendingRoot = template.hydrate(data, updater);
    }

    this._template = template;
    this._priority = LOWEST_PRIORITY;
    this._flags &= ~TemplateFlags.UPDATING;
  }

  commit(): void {
    if (this._flags & TemplateFlags.UNMOUNTING) {
      this._memoizedRoot?.unmount(this._part);
    } else {
      this._memoizedRoot?.unmount(this._part);
      this._pendingRoot?.mount(this._part);
      this._memoizedRoot = this._pendingRoot;
    }

    this._flags &= ~(TemplateFlags.MUTATING | TemplateFlags.UNMOUNTING);
  }

  disconnect(): void {
    this._pendingRoot?.disconnect();

    if (this._memoizedRoot !== this._pendingRoot) {
      this._memoizedRoot?.disconnect();
    }

    this._pendingRoot = null;
  }

  private _requestMutation(updater: Updater<TContext>): void {
    if (!(this._flags & TemplateFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= TemplateFlags.MUTATING;
    }
  }
}
