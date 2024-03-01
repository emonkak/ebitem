import { directiveTag } from './directive.js';
import { Fragment } from './fragment.js';
import { Part } from './part.js';
import { ChildPart } from './part/child.js';
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

  [directiveTag](part: Part, updater: Updater): void {
    if (!(part instanceof ChildPart)) {
      throw new Error(
        'TemplateResult directive must be used in an arbitrary child.',
      );
    }

    const fragment = part.value;

    if (fragment instanceof Fragment && fragment.template === this._template) {
      fragment.values = this._values;
      fragment.forceUpdate(updater);
    } else {
      const newFragment = new Fragment(
        this._template,
        this._values,
        updater.currentRenderable,
      );

      part.value = newFragment;

      updater.enqueueRenderable(newFragment);
      updater.enqueueMutationEffect(part);
      updater.requestUpdate();
    }
  }
}
