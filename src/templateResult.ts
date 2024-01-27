import type { Context } from './context';
import { directiveSymbol } from './directive';
import { Fragment } from './fragment';
import type { Cleanup, Part, TemplateInterface } from './types';

export class TemplateResult {
  private readonly _template: TemplateInterface;

  private readonly _values: unknown[];

  constructor(template: TemplateInterface, values: unknown[]) {
    this._template = template;
    this._values = values;
  }

  get template(): TemplateInterface {
    return this._template;
  }

  get values(): unknown[] {
    return this._values;
  }

  [directiveSymbol](part: Part, context: Context): Cleanup | void {
    const value = part.value;

    let needsMount = false;

    if (value instanceof Fragment) {
      if (value.template === this._template) {
        const needsRequestUpdate = !value.isDirty;
        value.setValues(this._values);
        if (needsRequestUpdate) {
          context.requestUpdate(value);
        }
      } else {
        needsMount = true;
      }
    } else {
      needsMount = true;
    }

    if (needsMount) {
      const newFragment = new Fragment(
        this._template,
        this._values,
        context.currentRenderable,
      );
      part.setValue(newFragment);
      context.requestUpdate(newFragment);
      context.pushMutationEffect(part);
    }
  }
}
