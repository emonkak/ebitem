import { Block as BlockChild } from '../block';
import { Directive, directiveSymbol } from '../directive';
import { Part } from '../part';
import { ChildPart } from '../parts';
import type { TemplateResult } from '../templateResult';
import type { Updater } from '../updater';

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
      throw new Error('"List" directive must be used in an arbitrary child.');
    }

    const value = part.value;

    let needsMount = false;

    if (value instanceof BlockChild) {
      if (value.type === this._type) {
        // Update will be skipped if the same directive is called twice.
        if (value.props !== this._props) {
          value.setProps(this._props);
          value.scheduleUpdate(updater);
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

      part.setValue(newBlock);

      updater.requestUpdate(newBlock);
      updater.pushMutationEffect(part);
    }
  }
}
