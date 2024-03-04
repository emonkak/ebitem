import { Fragment } from './fragment.js';
import { Binding, ChildNodePart, Directive, directiveTag } from './part.js';
import { Part } from './part.js';
import type { Template } from './template.js';
import type { Updater } from './updater.js';

export class TemplateResult implements Directive<TemplateResult> {
  private readonly _template: Template;

  private readonly _values: unknown[];

  constructor(template: Template, values: unknown[]) {
    this._template = template;
    this._values = values;
  }

  get template(): Template {
    return this._template;
  }

  get values(): unknown[] {
    return this._values;
  }

  [directiveTag](part: Part, updater: Updater): TemplateBinding {
    if (part.type !== 'childNode') {
      throw new Error(
        `${this.constructor.name} directive must be used in ChildNodePart.`,
      );
    }

    const binding = new TemplateBinding(part);

    binding.bind(this, updater);

    return binding;
  }

  valueOf(): this {
    return this;
  }
}

export class TemplateBinding implements Binding<TemplateResult> {
  private readonly _part: ChildNodePart;

  private _fragment: Fragment | null = null;

  constructor(part: ChildNodePart) {
    this._part = part;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._fragment !== null && this._fragment.isMounted
      ? this._fragment.root?.childNodes[0] ?? this._part.node
      : this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind({ template, values }: TemplateResult, updater: Updater): void {
    if (this._fragment !== null && this._fragment.template !== template) {
      this._fragment.forceUnmount(updater);
      this._fragment === null;
    }

    if (this._fragment === null) {
      this._fragment = new Fragment(
        template,
        values,
        this._part,
        updater.currentRenderable,
      );
    }

    this._fragment.forceUpdate(updater);
  }

  unbind(updater: Updater): void {
    this._fragment?.forceUnmount(updater);
    this._fragment = null;
  }

  disconnect(): void {
    this._fragment?.disconnect();
  }
}
