import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  PartType,
  directiveTag,
} from './binding.js';
import { LOW_PRIORITY, TaskPriority, comparePriorities } from './scheduler.js';
import type { Scope } from './scope.js';
import type { Component, Effect, Updater } from './updater.js';

export interface Template<TData, TContext = unknown> {
  hydrate(
    data: TData,
    updater: Updater<TContext>,
  ): TemplateFragment<TData, TContext>;
  sameTemplate(other: Template<TData, TContext>): boolean;
}

export interface TemplateFragment<TData, TContext = unknown> {
  get startNode(): ChildNode | null;
  get endNode(): ChildNode | null;
  rehydrate(data: TData, updater: Updater<TContext>): void;
  detach(part: ChildNodePart, updater: Updater): void;
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

  private _memoizedFragment: TemplateFragment<TData, TContext> | null = null;

  private _pendingFragment: TemplateFragment<TData, TContext> | null = null;

  private _template: Template<TData, TContext> | null = null;

  private _priority: TaskPriority = LOW_PRIORITY;

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
    return this._memoizedFragment?.startNode ?? this._part.node;
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
      comparePriorities(priority, this._priority) > 0
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
    this._pendingFragment?.detach(this._part, updater);

    if (this._memoizedFragment !== this._pendingFragment) {
      this._memoizedFragment?.detach(this._part, updater);
    }

    this._requestMutation(updater);

    this._pendingFragment = null;
    this._flags |= TemplateFlags.UNMOUNTING;
    this._flags &= ~TemplateFlags.UPDATING;
  }

  render(updater: Updater<TContext>, _scope: Scope<TContext>): void {
    const { template, data } = this._value;

    if (this._pendingFragment !== null) {
      if (this._template && this._template.sameTemplate(template)) {
        this._pendingFragment.rehydrate(data, updater);
      } else {
        this._pendingFragment.detach(this._part, updater);
        this._pendingFragment = null;
      }
    }

    if (this._pendingFragment === null) {
      this._requestMutation(updater);
      this._pendingFragment = template.hydrate(data, updater);
    }

    this._template = template;
    this._priority = LOW_PRIORITY;
    this._flags &= ~TemplateFlags.UPDATING;
  }

  commit(): void {
    if (this._flags & TemplateFlags.UNMOUNTING) {
      this._memoizedFragment?.unmount(this._part);
    } else {
      this._memoizedFragment?.unmount(this._part);
      this._pendingFragment?.mount(this._part);
      this._memoizedFragment = this._pendingFragment;
    }

    this._flags &= ~(TemplateFlags.MUTATING | TemplateFlags.UNMOUNTING);
  }

  disconnect(): void {
    this._pendingFragment?.disconnect();

    if (this._memoizedFragment !== this._pendingFragment) {
      this._memoizedFragment?.disconnect();
    }

    this._pendingFragment = null;
  }

  private _requestMutation(updater: Updater<TContext>): void {
    if (!(this._flags & TemplateFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= TemplateFlags.MUTATING;
    }
  }
}
