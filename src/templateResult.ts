import { directiveSymbol } from './directive.js';
import { Part } from './part.js';
import { ChildPart } from './part/child.js';
import { Fragment } from './renderable/fragment.js';
import type { TemplateInterface } from './template.js';
import type { Updater } from './updater.js';

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

  [directiveSymbol](part: Part, updater: Updater): void {
    if (!(part instanceof ChildPart)) {
      throw new Error(
        '"TemplateResult" directive must be used in an arbitrary child.',
      );
    }

    const value = part.value;

    if (value instanceof Fragment && value.template === this._template) {
      value.setValues(this._values);
      value.forceUpdate(updater);
    } else {
      const newFragment = new Fragment(
        this._template,
        this._values,
        updater.currentRenderable,
      );

      part.setValue(newFragment, updater);

      updater.enqueueRenderable(newFragment);
      updater.enqueueMutationEffect(part);
      updater.requestUpdate();
    }
  }
}
