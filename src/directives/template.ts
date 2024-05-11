import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  PartType,
  directiveTag,
} from '../binding.js';
import { isHigherPriority } from '../scheduler.js';
import type { Scope } from '../scope.js';
import type { Template, TemplateRoot } from '../template.js';
import type { Component, Effect, Updater } from '../updater.js';

const TemplateFlags = {
  NONE: 0,
  UPDATING: 1 << 0,
  MUTATING: 1 << 1,
  UNMOUNTING: 1 << 2,
};

export class TemplateDirective implements Directive {
  private readonly _template: Template;

  private readonly _values: unknown[];

  constructor(template: Template, values: unknown[]) {
    this._template = template;
    this._values = values;
  }

  get template(): Template {
    return this._template;
  }

  get values(): unknown[] {
    return this._values;
  }

  [directiveTag](part: Part, updater: Updater): Binding<TemplateDirective> {
    if (part.type !== PartType.ChildNode) {
      throw new Error('TemplateDirective must be used in ChildNodePart.');
    }

    const binding = new TemplateBinding(this, part, updater.currentComponent);

    binding.bind(updater);

    return binding;
  }
}

export class TemplateBinding
  implements Binding<TemplateDirective>, Effect, Component
{
  private readonly _part: ChildNodePart;

  private readonly _parent: Component | null;

  private _value: TemplateDirective;

  private _memoizedRoot: TemplateRoot | null = null;

  private _pendingRoot: TemplateRoot | null = null;

  private _template: Template | null = null;

  private _priority: TaskPriority = 'user-blocking';

  private _flags = TemplateFlags.NONE;

  constructor(
    value: TemplateDirective,
    part: ChildNodePart,
    parent: Component | null = null,
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

  get value(): TemplateDirective {
    return this._value;
  }

  get parent(): Component | null {
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

  set value(newValue: TemplateDirective) {
    this._value = newValue;
  }

  requestUpdate(updater: Updater, priority: TaskPriority): void {
    if (!(this._flags & TemplateFlags.UPDATING)) {
      this._priority = priority;
      this._flags |= TemplateFlags.UPDATING;
      updater.enqueueComponent(this);
      updater.scheduleUpdate();
    } else if (isHigherPriority(priority, this._priority)) {
      this._priority = priority;
      updater.enqueueComponent(this);
    }

    this._flags &= ~TemplateFlags.UNMOUNTING;
  }

  bind(updater: Updater): void {
    if (!(this._flags & TemplateFlags.UPDATING)) {
      this._priority = this._parent?.priority ?? updater.getCurrentPriority();
      this._flags |= TemplateFlags.UPDATING;
      updater.enqueueComponent(this);
    }

    this._flags &= ~TemplateFlags.UNMOUNTING;
  }

  unbind(updater: Updater): void {
    this._pendingRoot?.unbindValues(updater);

    if (this._memoizedRoot !== this._pendingRoot) {
      this._memoizedRoot?.unbindValues(updater);
    }

    this._requestMutation(updater);

    this._pendingRoot = null;
    this._flags |= TemplateFlags.UNMOUNTING;
    this._flags &= ~TemplateFlags.UPDATING;
  }

  render(updater: Updater, _scope: Scope): void {
    const { template, values } = this._value;

    if (this._pendingRoot !== null) {
      if (this._template === template) {
        this._pendingRoot.bindValues(values, updater);
      } else {
        this._pendingRoot.unbindValues(updater);
        this._pendingRoot = null;
      }
    }

    if (this._pendingRoot === null) {
      this._requestMutation(updater);
      this._pendingRoot = template.hydrate(values, updater);
    }

    this._template = template;
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

  private _requestMutation(updater: Updater) {
    if (!(this._flags & TemplateFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= TemplateFlags.MUTATING;
    }
  }
}
