import { Block, BlockType } from '../block.js';
import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  directiveTag,
} from '../part.js';
import { Updater } from '../updater.js';

export function block<TProps, TContext>(
  type: BlockType<TProps, TContext>,
  props: TProps,
): BlockDirective<TProps, TContext> {
  return new BlockDirective(type, props);
}

export class BlockDirective<TProps, TContext>
  implements Directive<BlockDirective<TProps, TContext>>
{
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
    if (part.type !== 'childNode') {
      throw new Error(
        `${this.constructor.name} directive must be used in ChildNodePart.`,
      );
    }

    const binding = new BlockBinding<TProps, TContext>(part);

    binding.bind(this, updater);

    return binding;
  }

  valueOf(): this {
    return this;
  }
}

export class BlockBinding<TProps, TContext>
  implements Binding<BlockDirective<TProps, TContext>>
{
  private readonly _part: ChildNodePart;

  private _block: Block<TProps, TContext> | null = null;

  constructor(part: ChildNodePart) {
    this._part = part;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._block?.root?.isMounted
      ? this._block.root?.childNodes[0] ?? this._part.node
      : this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(
    { type, props }: BlockDirective<TProps, TContext>,
    updater: Updater<TContext>,
  ): void {
    if (this._block !== null && this._block.type !== type) {
      this._block.forceUnmount(updater);
      this._block = null;
    }

    if (this._block !== null) {
      this._block.props = props;
    } else {
      this._block = new Block(
        type,
        props,
        this._part,
        updater.currentRenderable,
      );
    }

    this._block.forceUpdate(updater);
  }

  unbind(updater: Updater): void {
    this._block?.forceUnmount(updater);
    this._block = null;
  }

  disconnect(): void {
    this._block?.disconnect();
  }
}
