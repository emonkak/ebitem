import {
  AbstractTemplate,
  AbstractTemplateRoot,
  Binding,
  ChildNodePart,
  Directive,
  Effect,
  Hook,
  HookType,
  Part,
  PartType,
  Renderable,
  Scope,
  Updater,
  directiveTag,
} from '../types.js';
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
  TYPE_CHANGED: 1 << 3,
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
    if (part.type !== PartType.CHILD_NODE) {
      throw new Error('BlockDirective must be used in ChildNodePart.');
    }

    const binding = new BlockBinding(this, part, updater.currentRenderable);

    binding.bind(updater);

    return binding;
  }
}

export class BlockBinding<TProps, TContext>
  implements Binding<BlockDirective<TProps, TContext>>, Effect, Renderable
{
  private readonly _part: ChildNodePart;

  private readonly _parent: Renderable<TContext> | null;

  private _pendingDirective: BlockDirective<TProps, TContext>;

  private _memoizedDirective: BlockDirective<TProps, TContext> | null = null;

  private _memoizedTemplate: AbstractTemplate | null = null;

  private _pendingRoot: AbstractTemplateRoot | null = null;

  private _memoizedRoot: AbstractTemplateRoot | null = null;

  private _cachedRoots: WeakMap<AbstractTemplate, AbstractTemplateRoot> | null =
    null;

  private _hooks: Hook[] = [];

  private _flags = BlockFlags.NONE;

  constructor(
    directive: BlockDirective<TProps, TContext>,
    part: ChildNodePart,
    parent: Renderable<TContext> | null = null,
  ) {
    this._pendingDirective = directive;
    this._part = part;
    this._parent = parent;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._memoizedRoot?.childNodes[0] ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get parent(): Renderable<TContext> | null {
    return this._parent;
  }

  get dirty(): boolean {
    return !!(
      this._flags & BlockFlags.UPDATING || this._flags & BlockFlags.UNMOUNTING
    );
  }

  get value(): BlockDirective<TProps, TContext> {
    return this._pendingDirective;
  }

  set value(newDirective: BlockDirective<TProps, TContext>) {
    this._pendingDirective = newDirective;
  }

  requestUpdate(updater: Updater): void {
    this._requestUpdate(updater);

    this._flags &= ~BlockFlags.UNMOUNTING;
  }

  bind(updater: Updater): void {
    this._requestUpdate(updater);

    this._flags &= ~BlockFlags.UNMOUNTING;
  }

  unbind(updater: Updater): void {
    this.disconnect();

    this._requestMutation(updater);

    this._flags |= BlockFlags.UNMOUNTING;
    this._flags &= ~BlockFlags.UPDATING;
  }

  render(updater: Updater<TContext>, scope: Scope<TContext>): void {
    if (!(this._flags & BlockFlags.UPDATING)) {
      return;
    }

    const { type, props } = this._pendingDirective;

    if (type !== this._memoizedDirective?.type) {
      cleanHooks(this._hooks);
      this._hooks = [];
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
        let newPendingRoot;

        // The new template is different from the previous one. Therefore, the
        // previous mount point is saved for future renders.
        if (this._cachedRoots !== null) {
          // Since it is rare that different templates are returned, we defer
          // creating mount point caches.
          newPendingRoot =
            this._cachedRoots.get(template) ??
            template.hydrate(values, updater);
        } else {
          this._cachedRoots = new WeakMap();
          newPendingRoot = template.hydrate(values, updater);
        }

        // Save and disconnect the previous pending template for future
        // renderings.
        this._cachedRoots.set(this._memoizedTemplate!, this._pendingRoot);
        this._pendingRoot.disconnect();

        this._pendingRoot = newPendingRoot;

        this._requestMutation(updater);
      } else {
        this._pendingRoot.update(values, updater);
      }
    } else {
      this._pendingRoot = template.hydrate(values, updater);

      this._requestMutation(updater);
    }

    this._memoizedDirective = this._pendingDirective;
    this._memoizedTemplate = template;
    this._flags &= ~BlockFlags.UPDATING;
  }

  disconnect(): void {
    this._pendingRoot?.disconnect();

    if (this._memoizedRoot !== this._pendingRoot) {
      this._memoizedRoot?.disconnect();
    }

    cleanHooks(this._hooks);

    this._pendingRoot = null;
    this._hooks = [];
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

  private _requestUpdate(updater: Updater): void {
    if (!(this._flags & BlockFlags.UPDATING)) {
      updater.enqueueRenderable(this);
      updater.scheduleUpdate();
      this._flags |= BlockFlags.UPDATING;
    }
  }

  private _requestMutation(updater: Updater): void {
    if (!(this._flags & BlockFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= BlockFlags.MUTATING;
    }
  }
}

function cleanHooks(hooks: Hook[]): void {
  for (let i = 0, l = hooks.length; i < l; i++) {
    const hook = hooks[i]!;
    if (hook.type === HookType.EFFECT) {
      hook.cleanup?.();
    }
  }
}
