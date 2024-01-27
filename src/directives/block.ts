import { Block as BlockChild } from '../block';
import type { Context } from '../context';
import { Directive, directiveSymbol } from '../directive';
import { ChildPart } from '../part';
import type { TemplateResult } from '../templateResult';
import type { Cleanup, Part } from '../types';

export class Block<TProps> implements Directive {
  private readonly _type: (props: TProps, context: Context) => TemplateResult;

  private readonly _props: TProps;

  constructor(
    type: (props: TProps, context: Context) => TemplateResult,
    props: TProps,
  ) {
    this._type = type;
    this._props = props;
  }

  [directiveSymbol](part: Part, context: Context): Cleanup | void {
    if (!(part instanceof ChildPart)) {
      throw new Error('"List" directive must be used in an arbitrary child.');
    }

    const value = part.value;

    let needsMount = false;

    if (value instanceof BlockChild) {
      if (value.type === this._type) {
        value.setProps(this._props);
        value.scheduleUpdate(context);
      } else {
        needsMount = true;
      }
    } else {
      needsMount = true;
    }

    if (needsMount) {
      const newBlock = new BlockChild(
        this._type,
        this._props,
        context.currentRenderable,
      );
      part.setValue(newBlock);
      context.requestUpdate(newBlock);
      context.pushMutationEffect(part);
    }
  }
}

export function block<TProps>(
  type: (props: TProps, context: Context) => TemplateResult,
  props: TProps,
): Block<TProps> {
  return new Block(type, props);
}
