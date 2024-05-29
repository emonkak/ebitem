import { Binding, Directive, directiveTag } from '../binding.js';
import { Hook, HookType } from '../hook.js';
import { ChildNodePart, Part, PartType } from '../part.js';
import { TaskPriority, comparePriorities } from '../scheduler.js';
import type {
  Component,
  Effect,
  Scope,
  Template,
  TemplateFragment,
  Updater,
} from '../types.js';
import type { TemplateDirective } from './template.js';

export type BlockType<TProps, TData, TContext> = (
  props: TProps,
  context: TContext,
) => TemplateDirective<TData, TContext>;

const BlockFlags = {
  NONE: 0,
  UPDATING: 1 << 0,
  MUTATING: 1 << 1,
  UNMOUNTING: 1 << 2,
};

export function block<TProps, TData, TContext>(
  type: BlockType<TProps, TData, TContext>,
  props: TProps,
): BlockDirective<TProps, TData, TContext> {
  return new BlockDirective(type, props);
}

export class BlockDirective<TProps, TData, TContext>
  implements Directive<TContext>
{
  private readonly _type: BlockType<TProps, TData, TContext>;

  private readonly _props: TProps;

  constructor(type: BlockType<TProps, TData, TContext>, props: TProps) {
    this._type = type;
    this._props = props;
  }

  get type(): BlockType<TProps, TData, TContext> {
    return this._type;
  }

  get props(): TProps {
    return this._props;
  }

  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): BlockBinding<TProps, TData, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error('BlockDirective must be used in ChildNodePart.');
    }

    const binding = new BlockBinding(this, part, updater.getCurrentComponent());

    binding.bind(updater);

    return binding;
  }
}

export class BlockBinding<TProps, TData, TContext>
  implements
    Binding<BlockDirective<TProps, TData, TContext>, TContext>,
    Effect,
    Component<TContext>
{
  private readonly _part: ChildNodePart;

  private readonly _parent: Component<TContext> | null;

  private _value: BlockDirective<TProps, TData, TContext>;

  private _memoizedType: BlockType<TProps, TData, TContext> | null = null;

  private _memoizedTemplate: Template<TData, TContext> | null = null;

  private _pendingFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedFragment: TemplateFragment<TData, TContext> | null = null;

  private _cachedFragments: WeakMap<
    Template<TData, TContext>,
    TemplateFragment<TData, TContext>
  > | null = null;

  private _hooks: Hook[] = [];

  private _priority: TaskPriority = 'background';

  private _flags = BlockFlags.NONE;

  constructor(
    value: BlockDirective<TProps, TData, TContext>,
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

  get value(): BlockDirective<TProps, TData, TContext> {
    return this._value;
  }

  set value(newValue: BlockDirective<TProps, TData, TContext>) {
    this._value = newValue;
  }

  render(scope: Scope<TContext>, updater: Updater<TContext>): void {
    const { type, props } = this._value;

    if (this._memoizedType !== null && type !== this._memoizedType) {
      this._cleanHooks();
    }

    const previousNumberOfHooks = this._hooks.length;
    const { template, data } = this._renderBlock(type, props, scope, updater);

    if (this._pendingFragment !== null) {
      if (this._hooks.length !== previousNumberOfHooks) {
        throw new Error(
          'The block has been rendered different number of hooks than during the previous render.',
        );
      }

      if (this._memoizedTemplate !== template) {
        // First, detach of the current fragment.
        this._pendingFragment.detach(this._part, updater);

        // We need to mount child nodes before hydration.
        this._requestMutation(updater);

        let nextFragment;

        if (this._cachedFragments !== null) {
          nextFragment = this._cachedFragments.get(template);
          if (nextFragment !== undefined) {
            nextFragment.update(data, updater);
          } else {
            nextFragment = template.hydrate(data, updater);
          }
        } else {
          // It is rare that different templates are returned, so we defer
          // creating fragment caches.
          this._cachedFragments = new WeakMap();
          nextFragment = template.hydrate(data, updater);
        }

        // Remember the previous fragment for future renderings.
        this._cachedFragments.set(
          this._memoizedTemplate!,
          this._pendingFragment,
        );

        this._pendingFragment = nextFragment;
      } else {
        this._pendingFragment.update(data, updater);
      }
    } else {
      // Child nodes must be mounted before hydration.
      this._requestMutation(updater);

      this._pendingFragment = template.hydrate(data, updater);
    }

    this._memoizedType = this._value.type;
    this._memoizedTemplate = template;
    this._priority = 'background';
    this._flags &= ~BlockFlags.UPDATING;
  }

  requestUpdate(updater: Updater, priority: TaskPriority): void {
    if (
      !(this._flags & BlockFlags.UPDATING) ||
      comparePriorities(priority, this._priority) > 0
    ) {
      this._priority = priority;
      this._flags |= BlockFlags.UPDATING;
      updater.enqueueComponent(this);
      updater.scheduleUpdate();
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
    this._pendingFragment?.detach(this._part, updater);

    if (this._memoizedFragment !== this._pendingFragment) {
      this._memoizedFragment?.detach(this._part, updater);
    }

    this._cleanHooks();
    this._requestMutation(updater);

    this._pendingFragment = null;
    this._flags |= BlockFlags.UNMOUNTING;
    this._flags &= ~BlockFlags.UPDATING;
  }

  disconnect(): void {
    this._pendingFragment?.disconnect();

    if (this._memoizedFragment !== this._pendingFragment) {
      this._memoizedFragment?.disconnect();
    }

    this._cleanHooks();

    this._pendingFragment = null;
  }

  commit(): void {
    if (this._flags & BlockFlags.UNMOUNTING) {
      this._memoizedFragment?.unmount(this._part);
    } else {
      this._memoizedFragment?.unmount(this._part);
      this._pendingFragment?.mount(this._part);
      this._memoizedFragment = this._pendingFragment;
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

  private _requestMutation(updater: Updater<TContext>): void {
    if (!(this._flags & BlockFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= BlockFlags.MUTATING;
    }
  }

  private _renderBlock<TProps, TData>(
    type: BlockType<TProps, TData, TContext>,
    props: TProps,
    scope: Scope<TContext>,
    updater: Updater<TContext>,
  ): TemplateDirective<TData, TContext> {
    const context = scope.startContext(this, this._hooks, updater);
    try {
      return type(props, context);
    } finally {
      scope.finishContext(context);
    }
  }
}
