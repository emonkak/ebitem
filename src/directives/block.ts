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

    let needsMount = false;

    if (value instanceof BlockChild) {
      if (value.type === this._type) {
        value.setProps(this._props);
        if (value.isDirty) {
          value.forceUpdate(updater);
        }
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
        updater.currentRenderable,
      );

      part.setValue(newBlock, updater);

      updater.pushRenderable(newBlock);
      updater.pushMutationEffect(part);
      updater.requestUpdate();
    }
  }
}
