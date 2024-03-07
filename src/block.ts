import { Hook } from './hook.js';
import type { ChildNodePart } from './part.js';
import type { Scope } from './scope.js';
import type { Template } from './template.js';
import type { TemplateResult } from './templateResult.js';
import { TemplateRoot } from './templateRoot.js';
import {
  CommitMode,
  Disconnect,
  Effect,
  Renderable,
  Updater,
} from './updater.js';

const BlockFlags = {
  NONE: 0,
  UPDATING: 1 << 0,
  MUTATING: 1 << 1,
  UNMOUNTING: 1 << 2,
};

export type BlockType<TProps, TContext> = (
  props: TProps,
  context: TContext,
) => TemplateResult;

export class Block<TProps, TContext> implements Effect, Renderable {
  private readonly _type: BlockType<TProps, TContext>;

  private readonly _part: ChildNodePart;

  private readonly _parent: Renderable<TContext> | null;

  private _props: TProps;

  private _memoizedTemplate: Template | null = null;

  private _pendingRoot: TemplateRoot | null = null;

  private _memoizedRoot: TemplateRoot | null = null;

  private _cachedRoots: WeakMap<Template, TemplateRoot> | null = null;

  private _hooks: Hook[] = [];

  private _flags = BlockFlags.NONE;

  constructor(
    type: BlockType<TProps, TContext>,
    props: TProps,
    part: ChildNodePart = {
      type: 'childNode',
      node: document.createComment(''),
    },
    parent: Renderable<TContext> | null = null,
  ) {
    this._type = type;
    this._part = part;
    this._props = props;
    this._parent = parent;
  }

  get type(): BlockType<TProps, TContext> {
    return this._type;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get props(): TProps {
    return this._props;
  }

  get parent(): Renderable<TContext> | null {
    return this._parent;
  }

  get dirty(): boolean {
    return !!(
      this._flags & BlockFlags.UPDATING || this._flags & BlockFlags.UNMOUNTING
    );
  }

  get root(): TemplateRoot | null {
    return this._memoizedRoot;
  }

  set props(newProps: TProps) {
    this._props = newProps;
  }

  forceUpdate(updater: Updater): void {
    if (!(this._flags & BlockFlags.UPDATING)) {
      updater.enqueueRenderable(this);
      updater.requestUpdate();
      this._flags |= BlockFlags.UPDATING;
    }

    this._flags &= ~BlockFlags.UNMOUNTING;
  }

  forceUnmount(updater: Updater): void {
    if (!(this._flags & BlockFlags.UNMOUNTING)) {
      if (!(this._flags & BlockFlags.MUTATING)) {
        updater.enqueueMutationEffect(this);
        this._flags |= BlockFlags.MUTATING;
      }

      this._flags |= BlockFlags.UNMOUNTING;
    }

    this._pendingRoot = null;
  }

  render(updater: Updater<TContext>, scope: Scope<TContext>): void {
    const previousNumberOfHooks = this._hooks.length;
    const render = this._type;
    const context = scope.createContext(this, this._hooks, updater);
    const { template, values } = render(this._props, context);

    if (this._memoizedRoot !== null) {
      if (this._hooks.length !== previousNumberOfHooks) {
        throw new Error(
          'The block has been rendered different number of hooks than during the previous render.',
        );
      }

      if (this._memoizedTemplate !== template) {
        // The new template is different from the previous one. The previous
        // mount point is saved for future renders.
        if (this._cachedRoots !== null) {
          // Since it is rare that different templates are returned, we defer
          // creating mount point caches.
          this._pendingRoot =
            this._cachedRoots.get(template) ??
            template.hydrate(values, updater);
        } else {
          this._cachedRoots = new WeakMap();
          this._pendingRoot = template.hydrate(values, updater);
        }

        // Save the memoized template for future renderings.
        this._cachedRoots.set(this._memoizedTemplate!, this._memoizedRoot);

        if (!(this._flags & BlockFlags.MUTATING)) {
          updater.enqueueMutationEffect(this);
          this._flags |= BlockFlags.MUTATING;
        }
      } else {
        this._memoizedRoot.patch(values, updater);
      }
    } else {
      this._pendingRoot = template.hydrate(values, updater);

      if (!(this._flags & BlockFlags.MUTATING)) {
        updater.enqueueMutationEffect(this);
        this._flags |= BlockFlags.MUTATING;
      }
    }

    this._memoizedTemplate = template;
    this._flags &= ~BlockFlags.UPDATING;
  }

  commit(mode: CommitMode, updater: Updater): void {
    switch (mode) {
      case 'mutation': {
        if (this._memoizedRoot !== this._pendingRoot) {
          if (this._memoizedRoot !== null) {
            this._memoizedRoot.unmount(this._part);

            updater.enqueuePassiveEffect(new Disconnect(this._memoizedRoot));
          }

          if (this._pendingRoot !== null) {
            this._pendingRoot.mount(this._part);
          }

          this._memoizedRoot = this._pendingRoot;
        }

        if (this._flags & BlockFlags.UNMOUNTING) {
          updater.enqueuePassiveEffect(this);
        }

        this._flags &= ~(BlockFlags.MUTATING | BlockFlags.UNMOUNTING);
        break;
      }
      case 'passive': {
        if (this._flags & BlockFlags.UNMOUNTING) {
          cleanHooks(this._hooks);
          this._hooks = [];
        }
        this._flags &= ~BlockFlags.UNMOUNTING;
      }
    }
  }

  disconnect() {
    cleanHooks(this._hooks);
    this._hooks = [];
  }
}

function cleanHooks(hooks: Hook[]): void {
  for (let i = 0, l = hooks.length; i < l; i++) {
    const hook = hooks[i]!;
    if (hook.type === 'effect') {
      hook.cleanup?.();
    }
  }
}
