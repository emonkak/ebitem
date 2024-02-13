import { directiveSymbol } from './directive.js';
import { Fragment } from './fragment.js';
import { Part } from './part.js';
import { ChildPart } from './parts.js';
import type { TemplateInterface } from './templateInterface.js';
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

    let needsMount = false;

    if (value instanceof Fragment) {
      if (value.template === this._template) {
        value.values = this._values;
        // Skip the update if the same directive is called twice.
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
      const newFragment = new Fragment(
        this._template,
        this._values,
        updater.currentRenderable,
      );

      part.setValue(newFragment, updater);

      updater.pushRenderable(newFragment);
      updater.pushMutationEffect(part);
      updater.requestUpdate();
    }
  }
}
