import { Part, PartChild } from './part.js';
import type { Renderable } from './renderable.js';
import type { ScopeInterface } from './scope.js';
import type { TemplateInterface } from './template.js';
import type { TemplateRoot } from './templateRoot.js';
import type { Updater } from './updater.js';

export class Fragment<TContext>
  extends PartChild
  implements Renderable<TContext>
{
  private readonly _template: TemplateInterface;

  private readonly _parent: Renderable<TContext> | null;

  private _pendingValues: unknown[];

  private _memoizedValues: unknown[];

  private _pendingRoot: TemplateRoot | null = null;

  private _memoizedRoot: TemplateRoot | null = null;

  private _dirty = false;

  constructor(
    template: TemplateInterface,
    values: unknown[],
    parent: Renderable<TContext> | null = null,
  ) {
    super();
    this._template = template;
    this._pendingValues = values;
    this._memoizedValues = values;
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

  get dirty(): boolean {
    return this._dirty;
  }

  get parent(): Renderable<TContext> | null {
    return this._parent;
  }

  get template(): TemplateInterface {
    return this._template;
  }

  get values(): unknown[] {
    return this._memoizedValues;
  }

  set values(newValues: unknown[]) {
    this._pendingValues = newValues;
  }

  forceUpdate(updater: Updater<TContext>): void {
    if (this._dirty || this._memoizedRoot === null) {
      return;
    }

    this._dirty = true;

    updater.enqueueRenderable(this);
    updater.requestUpdate();
  }

  render(updater: Updater<TContext>, _scope: ScopeInterface<TContext>): void {
    if (this._memoizedRoot !== null) {
      this._template.patch(
        this._memoizedRoot.parts,
        this._memoizedValues,
        this._pendingValues,
        updater,
      );
    } else {
      this._pendingRoot = this._template.mount(this._pendingValues, updater);
    }

    this._memoizedValues = this._pendingValues;
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
  }
}
