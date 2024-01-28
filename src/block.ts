import type { Context } from './context';
import { Hook, HookType } from './hook';
import { ChildPart, ChildValue } from './part';
import { TemplateResult } from './templateResult';
import type { Part, Renderable, TemplateInterface } from './types';

const BlockFlag = {
  MOUNTED: 0b001,
  UNMOUNTED: 0b010,
  DIRTY: 0b100,
};

export class Block<TProps = unknown> extends ChildValue implements Renderable {
  private readonly _type: (props: TProps, context: Context) => TemplateResult;

  private _pendingProps: TProps;

  private _memoizedProps: TProps;

  private _memoizedValues: unknown[] | null = null;

  private _memoizedTemplate: TemplateInterface | null = null;

  private _parent: Renderable | null = null;

  private _flags: number = BlockFlag.DIRTY;

  private _nodes: ChildNode[] = [];

  private _parts: Part[] = [];

  private _hooks: Hook[] = [];

  constructor(
    type: (props: TProps, context: Context) => TemplateResult,
    props: TProps,
    parent: Renderable | null = null,
  ) {
    super();
    this._type = type;
    this._pendingProps = props;
    this._memoizedProps = props;
    this._parent = parent;
  }

  get startNode(): ChildNode | null {
    return this._nodes[0] ?? null;
  }

  get endNode(): ChildNode | null {
    return this._nodes[this._nodes.length - 1] ?? null;
  }

  get type(): (props: TProps, context: Context) => TemplateResult {
    return this._type;
  }

  get props(): TProps {
    return this._memoizedProps;
  }

  get parent(): Renderable | null {
    return this._parent;
  }

  get hooks(): Hook[] {
    return this._hooks;
  }

  get isDirty(): boolean {
    return (this._flags & BlockFlag.DIRTY) !== 0;
  }

  setProps(newProps: TProps): void {
    this._pendingProps = newProps;
  }

  scheduleUpdate(context: Context): void {
    const needsUpdate =
      (this._flags & BlockFlag.MOUNTED) !== 0 &&
      (this._flags & BlockFlag.UNMOUNTED) === 0 &&
      (this._flags & BlockFlag.DIRTY) === 0;

    if (needsUpdate) {
      this._flags |= BlockFlag.DIRTY;
      context.requestUpdate(this);
    }
  }

  render(context: Context): void {
    const render = this._type;
    const { template, values } = render(this._pendingProps, context);

    if (
      this._memoizedTemplate !== null &&
      this._memoizedTemplate !== template
    ) {
      this._cleanTemplateStates(context);
      this._memoizedValues = null;
    }

    if (this._memoizedValues === null) {
      const { node, parts } = template.mount(values, context);
      this._nodes = Array.from(node.childNodes);
      this._parts = parts;
      this._memoizedValues = values;
    } else {
      template.patch(this._parts, this._memoizedValues, values, context);
      this._memoizedValues = values;
    }

    this._flags ^= BlockFlag.DIRTY;
    this._memoizedProps = this._pendingProps;
    this._memoizedTemplate = template;
  }

  mount(part: ChildPart, _context: Context): void {
    const reference = part.endNode;
    const parent = reference.parentNode;

    if (parent) {
      for (let i = 0, l = this._nodes.length; i < l; i++) {
        parent.insertBefore(this._nodes[i]!, reference);
      }
    }

    this._flags |= BlockFlag.MOUNTED;
  }

  unmount(_part: ChildPart, context: Context): void {
    for (let i = 0, l = this._hooks.length; i < l; i++) {
      const hook = this._hooks[i]!;
      if (
        hook.type === HookType.EFFECT ||
        hook.type === HookType.LAYOUT_EFFECT
      ) {
        hook.cleanup?.(context);
      }
    }

    this._cleanTemplateStates(context);

    this._flags |= BlockFlag.UNMOUNTED;
    this._flags ^= BlockFlag.DIRTY;
  }

  update(_part: ChildPart, _context: Context): void {}

  _cleanTemplateStates(context: Context): void {
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
}
