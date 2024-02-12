import { Part } from './part.js';
import { ChildPart, ChildValue } from './parts.js';
import type { ScopeInterface } from './scopeInterface.js';
import type { TemplateInterface } from './templateInterface.js';
import type { Renderable, Updater } from './updater.js';

const FragmentFlag = {
  DIRTY: 0b1,
  UPDATING: 0b10,
};

export class Fragment<TContext>
  extends ChildValue
  implements Renderable<TContext>
{
  private readonly _template: TemplateInterface;

  private _pendingValues: unknown[];

  private _memoizedValues: unknown[] = [];

  private _parent: Renderable<TContext> | null = null;

  private _children: ChildNode[] = [];

  private _parts: Part[] = [];

  private _flags = FragmentFlag.DIRTY;

  constructor(
    template: TemplateInterface,
    values: unknown[],
    parent: Renderable<TContext> | null = null,
  ) {
    super();
    this._template = template;
    this._pendingValues = values;
    this._parent = parent;
  }

  get endNode(): ChildNode | null {
    return this._children[this._children.length - 1] ?? null;
  }

  get isDirty(): boolean {
    return (this._flags & FragmentFlag.DIRTY) !== 0;
  }

  get parent(): Renderable<TContext> | null {
    return this._parent;
  }

  get startNode(): ChildNode | null {
    return this._children[0] ?? null;
  }

  get template(): TemplateInterface {
    return this._template;
  }

  get values(): unknown[] {
    return this._memoizedValues;
  }

  forceUpdate(updater: Updater<TContext>): void {
    if ((this._flags & FragmentFlag.UPDATING) !== 0) {
      return;
    }

    this._flags |= FragmentFlag.UPDATING;
    updater.requestUpdate(this);
  }

  setValues(values: unknown[]): void {
    if (values !== this._pendingValues) {
      this._pendingValues = values;
      this._flags |= FragmentFlag.DIRTY;
    }
  }

  render(_scope: ScopeInterface<TContext>, updater: Updater<TContext>): void {
    if (this._memoizedValues === null) {
      const { children, parts } = this._template.mount(
        this._pendingValues,
        updater,
      );
      this._children = children;
      this._parts = parts;
    } else {
      this._template.patch(
        this._parts,
        this._memoizedValues,
        this._pendingValues,
        updater,
      );
    }

    this._memoizedValues = this._pendingValues;
    this._flags ^= FragmentFlag.DIRTY | FragmentFlag.UPDATING;
  }

  mount(part: ChildPart, _updater: Updater): void {
    const reference = part.endNode;
    const parent = reference.parentNode;

    if (parent) {
      for (let i = 0, l = this._children.length; i < l; i++) {
        parent.insertBefore(this._children[i]!, reference);
      }
    }
  }

  unmount(_part: ChildPart, updater: Updater): void {
    for (let i = 0, l = this._children.length; i < l; i++) {
      const child = this._children[i]!;
      child.remove();
    }

    for (let i = 0, l = this._parts.length; i < l; i++) {
      const part = this._parts[i]!;
      part.disconnect(updater);
    }
  }

  update(_part: ChildPart, _updater: Updater): void {}
}
