import { Binding, Directive, directiveTag } from '../binding.js';
import {
  ChildNodePart,
  Effect,
  Part,
  PartType,
  Renderable,
  Scope,
  Template,
  TemplateRoot,
  Updater,
} from '../types.js';

const FragmentFlags = {
  NONE: 0,
  UPDATING: 1 << 0,
  MUTATING: 1 << 1,
  UNMOUNTING: 1 << 2,
  MOUNTED: 1 << 3,
};

export class TemplateDirective implements Directive {
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
    if (part.type !== PartType.CHILD_NODE) {
      throw new Error(
        `${this.constructor.name} directive must be used in ChildNodePart.`,
      );
    }

    const binding = new TemplateBinding(part, this, updater.currentRenderable);

    binding.bind(updater);

    return binding;
  }
}

export class TemplateBinding
  implements Binding<TemplateDirective>, Effect, Renderable
{
  private readonly _part: ChildNodePart;

  private readonly _parent: Renderable | null;

  private _directive: TemplateDirective;

  private _memoizedRoot: TemplateRoot | null = null;

  private _pendingRoot: TemplateRoot | null = null;

  private _template: Template | null = null;

  private _flags = FragmentFlags.NONE;

  constructor(
    part: ChildNodePart,
    directive: TemplateDirective,
    parent: Renderable | null = null,
  ) {
    this._part = part;
    this._directive = directive;
    this._parent = parent;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._memoizedRoot?.childNodes[0] ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): TemplateDirective {
    return this._directive;
  }

  get parent(): Renderable | null {
    return this._parent;
  }

  get dirty(): boolean {
    return !!(
      this._flags & FragmentFlags.UPDATING ||
      this._flags & FragmentFlags.UNMOUNTING
    );
  }

  set value(directive: TemplateDirective) {
    this._directive = directive;
  }

  forceUpdate(updater: Updater): void {
    this._requestUpdate(updater);

    this._flags &= ~FragmentFlags.UNMOUNTING;
  }

  bind(updater: Updater): void {
    this._requestUpdate(updater);

    this._flags &= ~FragmentFlags.UNMOUNTING;
  }

  unbind(updater: Updater): void {
    this.disconnect();

    this._requestMutation(updater);

    this._flags |= FragmentFlags.UNMOUNTING;
    this._flags &= ~FragmentFlags.UPDATING;
  }

  render(updater: Updater, _scope: Scope): void {
    if (!(this._flags & FragmentFlags.UPDATING)) {
      return;
    }

    const { template, values } = this._directive;

    if (this._pendingRoot !== null && this._template !== template) {
      this._pendingRoot.disconnect();
      this._pendingRoot = null;
    }

    if (this._pendingRoot !== null) {
      this._pendingRoot.patch(values, updater);
    } else {
      this._pendingRoot = template.hydrate(values, updater);
      this._requestMutation(updater);
    }

    this._template = template;
    this._flags &= ~FragmentFlags.UPDATING;
  }

  commit(): void {
    if (this._flags & FragmentFlags.UNMOUNTING) {
      this._memoizedRoot?.unmount(this._part);
      this._flags &= ~FragmentFlags.MOUNTED;
    } else {
      this._memoizedRoot?.unmount(this._part);
      this._pendingRoot?.mount(this._part);
      this._memoizedRoot = this._pendingRoot;
      this._flags |= FragmentFlags.MOUNTED;
    }

    this._flags &= ~(FragmentFlags.MUTATING | FragmentFlags.UNMOUNTING);
  }

  disconnect(): void {
    this._pendingRoot?.disconnect();

    if (this._memoizedRoot !== this._pendingRoot) {
      this._memoizedRoot?.disconnect();
    }

    this._pendingRoot = null;
  }

  private _requestUpdate(updater: Updater) {
    if (!(this._flags & FragmentFlags.UPDATING)) {
      updater.enqueueRenderable(this);
      updater.requestUpdate();
      this._flags |= FragmentFlags.UPDATING;
    }
  }

  private _requestMutation(updater: Updater) {
    if (!(this._flags & FragmentFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= FragmentFlags.MUTATING;
    }
  }
}
