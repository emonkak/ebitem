import type { Context } from './context';
import { ChildPart, ChildValue } from './part';
import type { Part, Renderable, TemplateInterface } from './types';

export class Fragment extends ChildValue implements Renderable {
  private readonly _template: TemplateInterface;

  private _pendingValues: unknown[];

  private _memoizedValues: unknown[] = [];

  private _parent: Renderable | null = null;

  private _nodes: ChildNode[] = [];

  private _parts: Part[] = [];

  constructor(
    template: TemplateInterface,
    values: unknown[],
    parent: Renderable | null = null,
  ) {
    super();
    this._template = template;
    this._pendingValues = values;
    this._parent = parent;
  }

  get startNode(): ChildNode | null {
    return this._nodes[0] ?? null;
  }

  get endNode(): ChildNode | null {
    return this._nodes[this._nodes.length - 1] ?? null;
  }

  get parent(): Renderable | null {
    return this._parent;
  }

  get template(): TemplateInterface {
    return this._template;
  }

  get isDirty(): boolean {
    return this._memoizedValues !== this._pendingValues;
  }

  setValues(values: unknown[]): void {
    this._pendingValues = values;
  }

  mount(part: ChildPart, _context: Context): void {
    const reference = part.endNode;
    const parent = reference.parentNode;

    if (parent) {
      for (let i = 0, l = this._nodes.length; i < l; i++) {
        parent.insertBefore(this._nodes[i]!, reference);
      }
    }
  }

  unmount(_part: ChildPart, context: Context): void {
    for (let i = 0, l = this._nodes.length; i < l; i++) {
      const node = this._nodes[i]!;
      if (node.isConnected) {
        node.remove();
      }
    }

    for (let i = 0, l = this._parts.length; i < l; i++) {
      const part = this._parts[i]!;
      part.disconnect(context);
    }
  }

  update(_part: ChildPart, _context: Context): void {}

  render(context: Context): void {
    if (this._memoizedValues === null) {
      const { node, parts } = this._template.mount(
        this._pendingValues,
        context,
      );
      this._nodes = Array.from(node.childNodes);
      this._parts = parts;
    } else {
      this._template.patch(
        this._parts,
        this._memoizedValues,
        this._pendingValues,
        context,
      );
    }

    this._memoizedValues = this._pendingValues;
  }
}
