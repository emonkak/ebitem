import { Part } from './part';
import { ChildPart, ChildValue } from './parts';
import type { ScopeInterface } from './scopeInterface';
import type { TemplateInterface } from './templateInterface';
import type { Renderable, Updater } from './updater';

export class Fragment<TContext>
  extends ChildValue
  implements Renderable<TContext>
{
  private readonly _template: TemplateInterface;

  private _pendingValues: unknown[];

  private _memoizedValues: unknown[] = [];

  private _parent: Renderable<TContext> | null = null;

  private _nodes: ChildNode[] = [];

  private _parts: Part[] = [];

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
    return this._nodes[this._nodes.length - 1] ?? null;
  }

  get isDirty(): boolean {
    return this._memoizedValues !== this._pendingValues;
  }

  get parent(): Renderable<TContext> | null {
    return this._parent;
  }

  get startNode(): ChildNode | null {
    return this._nodes[0] ?? null;
  }

  get template(): TemplateInterface {
    return this._template;
  }

  scheduleUpdate(updater: Updater<TContext>): void {
    updater.requestUpdate(this);
  }

  setValues(values: unknown[]): void {
    this._pendingValues = values;
  }

  render(_scope: ScopeInterface<TContext>, updater: Updater<TContext>): void {
    if (this._memoizedValues === null) {
      const { node, parts } = this._template.mount(
        this._pendingValues,
        updater,
      );
      this._nodes = Array.from(node.childNodes);
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
  }

  mount(part: ChildPart, _updater: Updater): void {
    const reference = part.endNode;
    const parent = reference.parentNode;

    if (parent) {
      for (let i = 0, l = this._nodes.length; i < l; i++) {
        parent.insertBefore(this._nodes[i]!, reference);
      }
    }
  }

  unmount(_part: ChildPart, updater: Updater): void {
    for (let i = 0, l = this._nodes.length; i < l; i++) {
      const node = this._nodes[i]!;
      if (node.isConnected) {
        node.remove();
      }
    }

    for (let i = 0, l = this._parts.length; i < l; i++) {
      const part = this._parts[i]!;
      part.disconnect(updater);
    }
  }

  update(_part: ChildPart, _updater: Updater): void {}
}
