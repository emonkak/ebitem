import { directiveSymbol } from './directive';
import { Fragment } from './fragment';
import { Part } from './part';
import { ChildPart } from './parts';
import type { TemplateInterface } from './templateInterface';
import type { Updater } from './updater';

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

  [directiveSymbol](part: Part, updater: Updater<unknown>): void {
    if (!(part instanceof ChildPart)) {
      throw new Error(
        '"TemplateResult" directive must be used in an arbitrary child.',
      );
    }

    const value = part.value;

    let needsMount = false;

    if (value instanceof Fragment) {
      if (value.template === this._template) {
        const needsRequestUpdate = !value.isDirty;
        value.setValues(this._values);
        if (needsRequestUpdate) {
          updater.requestUpdate(value);
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
        updater.currentRenderable,
      );

      part.setValue(newFragment);

      updater.requestUpdate(newFragment);
      updater.pushMutationEffect(part);
    }
  }
}
