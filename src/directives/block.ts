import { Block as BlockChild } from '../block.js';
import { Directive, directiveSymbol } from '../directive.js';
import { Part } from '../part.js';
import { ChildPart } from '../parts.js';
import type { TemplateResult } from '../templateResult.js';
import type { Updater } from '../updater.js';

export function block<TProps, TContext>(
  type: (props: TProps, context: TContext) => TemplateResult,
  props: TProps,
): Block<TProps, TContext> {
  return new Block(type, props);
}

export class Block<TProps, TContext> implements Directive {
  private readonly _type: (props: TProps, context: TContext) => TemplateResult;

  private readonly _props: TProps;

  constructor(
    type: (props: TProps, context: TContext) => TemplateResult,
    props: TProps,
  ) {
    this._type = type;
    this._props = props;
  }

  [directiveSymbol](part: Part, updater: Updater): void {
    if (!(part instanceof ChildPart)) {
      throw new Error('"Block" directive must be used in an arbitrary child.');
    }

    const value = part.value;

    if (value instanceof BlockChild && value.type === this._type) {
      value.setProps(this._props);
      value.forceUpdate(updater);
    } else {
      const newBlock = new BlockChild(
        this._type,
        this._props,
        updater.currentRenderable,
      );

      part.setValue(newBlock, updater);

      updater.enqueueRenderable(newBlock);
      updater.enqueueMutationEffect(part);
      updater.requestUpdate();
    }
  }
}
