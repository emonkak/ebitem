import {
  AbstractScope,
  AbstractTemplate,
  AbstractTemplateRoot,
  Binding,
  ChildNodePart,
  Directive,
  Effect,
  Part,
  PartType,
  Renderable,
  Updater,
  directiveTag,
} from '../types.js';

const TemplateFlags = {
  NONE: 0,
  UPDATING: 1 << 0,
  MUTATING: 1 << 1,
  UNMOUNTING: 1 << 2,
};

export class TemplateDirective implements Directive {
  private readonly _template: AbstractTemplate;

  private readonly _values: unknown[];

  constructor(template: AbstractTemplate, values: unknown[]) {
    this._template = template;
    this._values = values;
  }

  get template(): AbstractTemplate {
    return this._template;
  }

  get values(): unknown[] {
    return this._values;
  }

  [directiveTag](part: Part, updater: Updater): Binding<TemplateDirective> {
    if (part.type !== PartType.CHILD_NODE) {
      throw new Error('TemplateDirective must be used in ChildNodePart.');
    }

    const binding = new TemplateBinding(this, part, updater.currentRenderable);

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

  private _memoizedRoot: AbstractTemplateRoot | null = null;

  private _pendingRoot: AbstractTemplateRoot | null = null;

  private _template: AbstractTemplate | null = null;

  private _flags = TemplateFlags.NONE;

  constructor(
    directive: TemplateDirective,
    part: ChildNodePart,
    parent: Renderable | null = null,
  ) {
    this._directive = directive;
    this._part = part;
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
      this._flags & TemplateFlags.UPDATING ||
      this._flags & TemplateFlags.UNMOUNTING
    );
  }

  set value(newDirective: TemplateDirective) {
    this._directive = newDirective;
  }

  requestUpdate(updater: Updater): void {
    this._requestUpdate(updater);

    this._flags &= ~TemplateFlags.UNMOUNTING;
  }

  bind(updater: Updater): void {
    this._requestUpdate(updater);

    this._flags &= ~TemplateFlags.UNMOUNTING;
  }

  unbind(updater: Updater): void {
    this.disconnect();

    this._requestMutation(updater);

    this._flags |= TemplateFlags.UNMOUNTING;
    this._flags &= ~TemplateFlags.UPDATING;
  }

  render(updater: Updater, _scope: AbstractScope): void {
    if (!(this._flags & TemplateFlags.UPDATING)) {
      return;
    }

    const { template, values } = this._directive;

    if (this._pendingRoot !== null && this._template !== template) {
      this._pendingRoot.disconnect();
      this._pendingRoot = null;
    }

    if (this._pendingRoot !== null) {
      this._pendingRoot.update(values, updater);
    } else {
      this._pendingRoot = template.hydrate(values, updater);
      this._requestMutation(updater);
    }

    this._template = template;
    this._flags &= ~TemplateFlags.UPDATING;
  }

  commit(): void {
    if (this._flags & TemplateFlags.UNMOUNTING) {
      this._memoizedRoot?.unmount(this._part);
    } else {
      this._memoizedRoot?.unmount(this._part);
      this._pendingRoot?.mount(this._part);
      this._memoizedRoot = this._pendingRoot;
    }

    this._flags &= ~(TemplateFlags.MUTATING | TemplateFlags.UNMOUNTING);
  }

  disconnect(): void {
    this._pendingRoot?.disconnect();

    if (this._memoizedRoot !== this._pendingRoot) {
      this._memoizedRoot?.disconnect();
    }

    this._pendingRoot = null;
  }

  private _requestUpdate(updater: Updater) {
    if (!(this._flags & TemplateFlags.UPDATING)) {
      updater.enqueueRenderable(this);
      updater.scheduleUpdate();
      this._flags |= TemplateFlags.UPDATING;
    }
  }

  private _requestMutation(updater: Updater) {
    if (!(this._flags & TemplateFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
      this._flags |= TemplateFlags.MUTATING;
    }
  }
}
