import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
} from '../binding.js';
import { comparePriorities } from '../scheduler.js';
import {
  type Block,
  type ChildNodePart,
  type Component,
  type Effect,
  type Hook,
  HookType,
  type Part,
  PartType,
  type TaskPriority,
  type Template,
  type TemplateFragment,
  type UpdateContext,
  type Updater,
} from '../types.js';

const FLAG_NONE = 0;
const FLAG_UPDATING = 1 << 0;
const FLAG_MUTATING = 1 << 1;
const FLAG_UNMOUNTING = 1 << 2;

export function block<TProps, TData, TContext>(
  type: Block<TProps, TData, TContext>,
  props: TProps,
): BlockDirective<TProps, TData, TContext> {
  return new BlockDirective(type, props);
}

export class BlockDirective<TProps, TData, TContext>
  implements Directive<TContext>
{
  private readonly _type: Block<TProps, TData, TContext>;

  private readonly _props: TProps;

  constructor(type: Block<TProps, TData, TContext>, props: TProps) {
    this._type = type;
    this._props = props;
  }

  get type(): Block<TProps, TData, TContext> {
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
    return new BlockBinding(this, part, updater.getCurrentComponent());
  }
}

export class BlockBinding<TProps, TData, TContext>
  implements
    Binding<BlockDirective<TProps, TData, TContext>, TContext>,
    Effect,
    Component<TContext>
{
  private _directive: BlockDirective<TProps, TData, TContext>;

  private readonly _part: ChildNodePart;

  private readonly _parent: Component<TContext> | null;

  private _memoizedType: Block<TProps, TData, TContext> | null = null;

  private _memoizedTemplate: Template<TData, TContext> | null = null;

  private _pendingFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedFragment: TemplateFragment<TData, TContext> | null = null;

  private _cachedFragments: WeakMap<
    Template<TData, TContext>,
    TemplateFragment<TData, TContext>
  > | null = null;

  private _hooks: Hook[] = [];

  private _priority: TaskPriority = 'background';

  private _flags = FLAG_NONE;

  constructor(
    directive: BlockDirective<TProps, TData, TContext>,
    part: ChildNodePart,
    parent: Component<TContext> | null = null,
  ) {
    this._directive = directive;
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
    return !!(this._flags & FLAG_UPDATING || this._flags & FLAG_UNMOUNTING);
  }

  get value(): BlockDirective<TProps, TData, TContext> {
    return this._directive;
  }

  shouldUpdate(): boolean {
    if (!this.dirty) {
      return false;
    }
    let current: Component<TContext> | null = this;
    while ((current = current.parent) !== null) {
      if (current.dirty) {
        return false;
      }
    }
    return true;
  }

  update(context: UpdateContext<TContext>, updater: Updater<TContext>): void {
    if (!(this._flags & FLAG_UPDATING)) {
      return;
    }

    const { type, props } = this._directive;

    if (this._memoizedType !== null && type !== this._memoizedType) {
      this._cleanHooks();
    }

    const { template, data } = context.renderBlock(
      type,
      props,
      this._hooks,
      this,
      updater,
    );

    if (this._pendingFragment !== null) {
      if (this._memoizedTemplate !== template) {
        // First, detach of the current fragment.
        this._pendingFragment.unbind(updater);

        // We need to mount child nodes before hydration.
        this._requestMutation(updater);

        let nextFragment;

        if (this._cachedFragments !== null) {
          nextFragment = this._cachedFragments.get(template);
          if (nextFragment !== undefined) {
            nextFragment.bind(data, updater);
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
        this._pendingFragment.bind(data, updater);
      }
    } else {
      // Child nodes must be mounted before hydration.
      this._requestMutation(updater);

      this._pendingFragment = template.hydrate(data, updater);
    }

    this._memoizedType = this._directive.type;
    this._memoizedTemplate = template;
    this._flags &= ~FLAG_UPDATING;
  }

  requestUpdate(priority: TaskPriority, updater: Updater): void {
    if (
      !(this._flags & FLAG_UPDATING) ||
      comparePriorities(priority, this._priority) > 0
    ) {
      this._priority = priority;
      this._flags |= FLAG_UPDATING;
      updater.enqueueComponent(this);
      updater.scheduleUpdate();
    }

    this._flags &= ~FLAG_UNMOUNTING;
  }

  bind(
    newValue: BlockDirective<TProps, TData, TContext>,
    updater: Updater,
  ): void {
    DEBUG: {
      ensureDirective(BlockDirective, newValue);
    }
    this._directive = newValue;
    this.rebind(updater);
  }

  rebind(updater: Updater): void {
    if (!(this._flags & FLAG_UPDATING)) {
      this._priority = this._parent?.priority ?? updater.getCurrentPriority();
      this._flags |= FLAG_UPDATING;
      updater.enqueueComponent(this);
    }

    this._flags &= ~FLAG_UNMOUNTING;
  }

  unbind(updater: Updater): void {
    this._pendingFragment?.unbind(updater);

    if (this._memoizedFragment !== this._pendingFragment) {
      this._memoizedFragment?.unbind(updater);
    }

    this._cleanHooks();
    this._requestMutation(updater);

    this._pendingFragment = null;
    this._flags |= FLAG_UNMOUNTING;
    this._flags &= ~FLAG_UPDATING;
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
    if (this._flags & FLAG_UNMOUNTING) {
      this._memoizedFragment?.unmount(this._part);
    } else {
      this._memoizedFragment?.unmount(this._part);
      this._pendingFragment?.mount(this._part);
      this._memoizedFragment = this._pendingFragment;
    }

    this._flags &= ~(FLAG_MUTATING | FLAG_UNMOUNTING);
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
    if (!(this._flags & FLAG_MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= FLAG_MUTATING;
    }
  }
}
