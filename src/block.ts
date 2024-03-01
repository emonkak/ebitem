import { CleanHooks, Hook } from './hook.js';
import { Part, PartChild } from './part.js';
import type { Renderable } from './renderable.js';
import type { ScopeInterface } from './scope.js';
import type { TemplateInterface } from './template.js';
import type { TemplateResult } from './templateResult.js';
import type { TemplateRoot } from './templateRoot.js';
import type { Updater } from './updater.js';

export class Block<TProps, TContext>
  extends PartChild
  implements Renderable<TContext>
{
  private readonly _type: (props: TProps, context: TContext) => TemplateResult;

  private readonly _parent: Renderable<TContext> | null;

  private _pendingProps: TProps;

  private _pendingRoot: TemplateRoot | null = null;

  private _memoizedProps: TProps;

  private _memoizedValues: unknown[] = [];

  private _memoizedTemplate: TemplateInterface | null = null;

  private _memoizedRoot: TemplateRoot | null = null;

  private _cachedRoots: WeakMap<TemplateInterface, TemplateRoot> | null = null;

  private _hooks: Hook[] = [];

  private _dirty = true;

  constructor(
    type: (props: TProps, context: TContext) => TemplateResult,
    props: TProps,
    parent: Renderable<TContext> | null = null,
  ) {
    super();
    this._type = type;
    this._pendingProps = props;
    this._memoizedProps = props;
    this._parent = parent;
  }

  get startNode(): ChildNode | null {
    return this._memoizedRoot?.childNodes[0] ?? null;
  }

  get endNode(): ChildNode | null {
    if (this._memoizedRoot !== null) {
      const { childNodes } = this._memoizedRoot;
      return childNodes[childNodes.length - 1]!;
    }
    return null;
  }

  get type(): (props: TProps, context: TContext) => TemplateResult {
    return this._type;
  }

  get props(): TProps {
    return this._memoizedProps;
  }

  get parent(): Renderable<TContext> | null {
    return this._parent;
  }

  get isDirty(): boolean {
    return this._dirty;
  }

  set props(newProps: TProps) {
    this._pendingProps = newProps;
  }

  forceUpdate(updater: Updater<TContext>): void {
    if (this._dirty || this._memoizedRoot === null) {
      return;
    }

    this._dirty = true;

    updater.enqueueRenderable(this);
    updater.enqueueMutationEffect(this);
    updater.requestUpdate();
  }

  render(updater: Updater<TContext>, scope: ScopeInterface<TContext>): void {
    const previousNumberOfHooks = this._hooks.length;

    const render = this._type;
    const context = scope.createContext(this, this._hooks, updater);
    const { template, values } = render(this._pendingProps, context);

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
            this._cachedRoots.get(template) ?? template.mount(values, updater);
        } else {
          this._cachedRoots = new WeakMap();
          this._pendingRoot = template.mount(values, updater);
        }

        // Save the memoized template for future renderings.
        this._cachedRoots.set(this._memoizedTemplate!, this._memoizedRoot);
      } else {
        template.patch(
          this._memoizedRoot.parts,
          this._memoizedValues,
          values,
          updater,
        );
      }
    } else {
      this._pendingRoot = template.mount(values, updater);
    }

    this._memoizedProps = this._pendingProps;
    this._memoizedTemplate = template;
    this._memoizedValues = values;
    this._dirty = false;
  }

  mount(part: Part, updater: Updater): void {
    if (this._pendingRoot !== null) {
      this._pendingRoot.mount(part, updater);
      this._memoizedRoot = this._pendingRoot;
    }
  }

  unmount(part: Part, updater: Updater): void {
    if (this._memoizedRoot !== null) {
      this._memoizedRoot.unmount(part, updater);
      this._memoizedRoot = null;
    }

    if (this._hooks.length > 0) {
      updater.enqueuePassiveEffect(new CleanHooks(this._hooks));
      this._hooks = [];
    }
  }

  commit(updater: Updater): void {
    this._memoizedRoot?.commit(updater);
  }
}
