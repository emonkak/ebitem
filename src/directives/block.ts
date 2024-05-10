import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  PartType,
  directiveTag,
} from '../binding.js';
import { Hook, HookType } from '../context.js';
import { isHigherPriority } from '../scheduler.js';
import type { AbstractScope } from '../scope.js';
import type { Template, TemplateRoot } from '../template.js';
import type { Component, Effect, Updater } from '../updater.js';
import type { TemplateDirective } from './template.js';

export type BlockType<TProps, TContext> = (
  props: TProps,
  context: TContext,
) => TemplateDirective;

const BlockFlags = {
  NONE: 0,
  UPDATING: 1 << 0,
  MUTATING: 1 << 1,
  UNMOUNTING: 1 << 2,
};

export function block<TProps, TContext>(
  type: BlockType<TProps, TContext>,
  props: TProps,
): BlockDirective<TProps, TContext> {
  return new BlockDirective(type, props);
}

export class BlockDirective<TProps, TContext> implements Directive<TContext> {
  private readonly _type: BlockType<TProps, TContext>;

  private readonly _props: TProps;

  constructor(type: BlockType<TProps, TContext>, props: TProps) {
    this._type = type;
    this._props = props;
  }

  get type(): BlockType<TProps, TContext> {
    return this._type;
  }

  get props(): TProps {
    return this._props;
  }

  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): BlockBinding<TProps, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error('BlockDirective must be used in ChildNodePart.');
    }

    const binding = new BlockBinding(this, part, updater.currentComponent);

    binding.bind(updater);

    return binding;
  }
}

export class BlockBinding<TProps, TContext>
  implements
    Binding<BlockDirective<TProps, TContext>>,
    Effect,
    Component<TContext>
{
  private readonly _part: ChildNodePart;

  private readonly _parent: Component<TContext> | null;

  private _value: BlockDirective<TProps, TContext>;

  private _memoizedType: BlockType<TProps, TContext> | null = null;

  private _memoizedTemplate: Template | null = null;

  private _pendingRoot: TemplateRoot | null = null;

  private _memoizedRoot: TemplateRoot | null = null;

  private _cachedRoots: WeakMap<Template, TemplateRoot> | null = null;

  private _hooks: Hook[] = [];

  private _priority: TaskPriority = 'user-visible';

  private _flags = BlockFlags.NONE;

  constructor(
    value: BlockDirective<TProps, TContext>,
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

  get parent(): Component<TContext> | null {
    return this._parent;
  }

  get priority(): TaskPriority {
    return this._priority;
  }

  get dirty(): boolean {
    return !!(
      this._flags & BlockFlags.UPDATING || this._flags & BlockFlags.UNMOUNTING
    );
  }

  get value(): BlockDirective<TProps, TContext> {
    return this._value;
  }

  set value(newValue: BlockDirective<TProps, TContext>) {
    this._value = newValue;
  }

  requestUpdate(updater: Updater, priority: TaskPriority): void {
    if (!(this._flags & BlockFlags.UPDATING)) {
      this._priority = priority;
      this._flags |= BlockFlags.UPDATING;
      updater.enqueueComponent(this);
      updater.scheduleUpdate();
    } else if (isHigherPriority(priority, this._priority)) {
      this._priority = priority;
      updater.enqueueComponent(this);
    }

    this._flags &= ~BlockFlags.UNMOUNTING;
  }

  bind(updater: Updater): void {
    if (!(this._flags & BlockFlags.UPDATING)) {
      this._priority = this._parent?.priority ?? updater.getCurrentPriority();
      this._flags |= BlockFlags.UPDATING;
      updater.enqueueComponent(this);
    }

    this._flags &= ~BlockFlags.UNMOUNTING;
  }

  unbind(updater: Updater): void {
    this._pendingRoot?.unbindValues(updater);

    if (this._memoizedRoot !== this._pendingRoot) {
      this._memoizedRoot?.unbindValues(updater);
    }

    this._cleanHooks();
    this._requestMutation(updater);

    this._pendingRoot = null;
    this._flags |= BlockFlags.UNMOUNTING;
    this._flags &= ~BlockFlags.UPDATING;
  }

  render(updater: Updater<TContext>, scope: AbstractScope<TContext>): void {
    const { type, props } = this._value;

    if (this._memoizedType !== null && type !== this._memoizedType) {
      this._cleanHooks();
    }

    const previousNumberOfHooks = this._hooks.length;
    const context = scope.createContext(this, this._hooks, updater);
    const { template, values } = type(props, context);

    if (this._pendingRoot !== null) {
      if (this._hooks.length !== previousNumberOfHooks) {
        throw new Error(
          'The block has been rendered different number of hooks than during the previous render.',
        );
      }

      if (this._memoizedTemplate !== template) {
        // First, unbind values of the current root.
        this._pendingRoot.unbindValues(updater);

        // We need to mount child nodes before hydration.
        this._requestMutation(updater);

        let nextRoot;

        if (this._cachedRoots !== null) {
          nextRoot = this._cachedRoots.get(template);
          if (nextRoot !== undefined) {
            nextRoot.bindValues(values, updater);
          } else {
            nextRoot = template.hydrate(values, updater);
          }
        } else {
          // It is rare that different templates are returned, so we defer
          // creating root caches.
          this._cachedRoots = new WeakMap();
          nextRoot = template.hydrate(values, updater);
        }

        // Remember the previous root for future renderings.
        this._cachedRoots.set(this._memoizedTemplate!, this._pendingRoot);

        this._pendingRoot = nextRoot;
      } else {
        this._pendingRoot.bindValues(values, updater);
      }
    } else {
      // Child nodes must be mounted before hydration.
      this._requestMutation(updater);

      this._pendingRoot = template.hydrate(values, updater);
    }

    this._memoizedType = this._value.type;
    this._memoizedTemplate = template;
    this._flags &= ~BlockFlags.UPDATING;
  }

  disconnect(): void {
    this._pendingRoot?.disconnect();

    if (this._memoizedRoot !== this._pendingRoot) {
      this._memoizedRoot?.disconnect();
    }

    this._cleanHooks();

    this._pendingRoot = null;
  }

  commit(): void {
    if (this._flags & BlockFlags.UNMOUNTING) {
      this._memoizedRoot?.unmount(this._part);
    } else {
      this._memoizedRoot?.unmount(this._part);
      this._pendingRoot?.mount(this._part);
      this._memoizedRoot = this._pendingRoot;
    }

    this._flags &= ~(BlockFlags.MUTATING | BlockFlags.UNMOUNTING);
  }

  private _cleanHooks(): void {
    const hooks = this._hooks;
    this._hooks = [];
    for (let i = 0, l = hooks.length; i < l; i++) {
      const hook = hooks[i]!;
      if (hook.type === HookType.Effect) {
        hook.cleanup?.();
      }
    }
  }

  private _requestMutation(updater: Updater): void {
    if (!(this._flags & BlockFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= BlockFlags.MUTATING;
    }
  }
}
