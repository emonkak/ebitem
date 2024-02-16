import { ChildPart, ChildValue } from './parts.js';
import type { ScopeInterface } from './scopeInterface.js';
import type { MountPoint, TemplateInterface } from './templateInterface.js';
import type { Renderable, Updater } from './updater.js';

const FragmentFlag = {
  DIRTY: 0b1,
  MOUNTED: 0b10,
};

export class Fragment<TContext>
  extends ChildValue
  implements Renderable<TContext>
{
  private readonly _template: TemplateInterface;

  private readonly _parent: Renderable<TContext> | null;

  private _pendingValues: unknown[];

  private _memoizedValues: unknown[];

  private _mountPoint: MountPoint | null = null;

  private _flags = FragmentFlag.DIRTY;

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

  get endNode(): ChildNode | null {
    if (this._mountPoint === null) {
      return null;
    }
    const { children } = this._mountPoint;
    return children[children.length - 1] ?? null;
  }

  get isDirty(): boolean {
    return (this._flags & FragmentFlag.DIRTY) !== 0;
  }

  get parent(): Renderable<TContext> | null {
    return this._parent;
  }

  get startNode(): ChildNode | null {
    return this._mountPoint?.children[0] ?? null;
  }

  get template(): TemplateInterface {
    return this._template;
  }

  get values(): unknown[] {
    return this._memoizedValues;
  }

  setValues(newValues: unknown[]) {
    this._pendingValues = newValues;
  }

  forceUpdate(updater: Updater<TContext>): void {
    if (
      (this._flags & FragmentFlag.MOUNTED) === 0 ||
      (this._flags & FragmentFlag.DIRTY) !== 0
    ) {
      return;
    }

    this._flags |= FragmentFlag.DIRTY;
    updater.pushRenderable(this);
    updater.requestUpdate();
  }

  render(updater: Updater<TContext>, _scope: ScopeInterface<TContext>): void {
    if (this._mountPoint !== null) {
      const { parts } = this._mountPoint;
      this._template.patch(
        parts,
        this._memoizedValues,
        this._pendingValues,
        updater,
      );
    } else {
      this._mountPoint = this._template.mount(this._pendingValues, updater);
    }

    this._memoizedValues = this._pendingValues;
    this._flags &= ~FragmentFlag.DIRTY;
  }

  mount(part: ChildPart, _updater: Updater): void {
    if (this._mountPoint !== null) {
      const { children } = this._mountPoint;
      const reference = part.endNode;
      const parent = reference.parentNode;

      if (parent !== null) {
        for (let i = 0, l = children.length; i < l; i++) {
          parent.insertBefore(children[i]!, reference);
        }
      }
    }

    this._flags |= FragmentFlag.MOUNTED;
  }

  unmount(_part: ChildPart, updater: Updater): void {
    if (this._mountPoint !== null) {
      const { children, parts } = this._mountPoint;
      for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i]!;
        child.remove();
      }

      for (let i = 0, l = parts.length; i < l; i++) {
        const part = parts[i]!;
        part.disconnect(updater);
      }

      this._mountPoint = null;
    }

    this._flags &= ~FragmentFlag.MOUNTED;
  }

  update(_part: ChildPart, _updater: Updater): void {}
}
