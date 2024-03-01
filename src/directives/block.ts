import { Block } from '../block.js';
import type { Context } from '../context.js';
import { Directive, directiveTag } from '../directive.js';
import type { Part } from '../part.js';
import { ChildPart } from '../part/child.js';
import type { TemplateResult } from '../templateResult.js';
import type { Updater } from '../updater.js';

export function block<TProps>(
  type: (props: TProps, context: Context) => TemplateResult,
  props: TProps,
): BlockDirective<TProps> {
  return new BlockDirective(type, props);
}

export class BlockDirective<TProps> implements Directive<Context> {
  private readonly _type: (props: TProps, context: Context) => TemplateResult;

  private readonly _props: TProps;

  constructor(
    type: (props: TProps, context: Context) => TemplateResult,
    props: TProps,
  ) {
    this._type = type;
    this._props = props;
  }

  [directiveTag](
    _context: Context,
    part: Part,
    updater: Updater<Context>,
  ): void {
    if (!(part instanceof ChildPart)) {
      throw new Error('Block directive must be used in an arbitrary child.');
    }

    const block = part.value;

    if (block instanceof Block && block.type === this._type) {
      block.props = this._props;
      block.forceUpdate(updater);
    } else {
      const newBlock = new Block(
        this._type,
        this._props,
        updater.currentRenderable,
      );

      part.value = newBlock;

      updater.enqueueRenderable(newBlock);
      updater.enqueueMutationEffect(part);
      updater.requestUpdate();
    }
  }
}
