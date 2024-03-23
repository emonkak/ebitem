import { Binding, Directive, directiveTag } from '../binding.js';
import { ChildNodePart, Part, PartType, Updater } from '../types.js';

export function unsafeHTML(content: string): UnsafeHTMLDirective {
  return new UnsafeHTMLDirective(content);
}

export class UnsafeHTMLDirective implements Directive {
  private readonly _unsafeContent: string;

  constructor(unsafeContent: string) {
    this._unsafeContent = unsafeContent;
  }

  get unsafeContent(): string {
    return this._unsafeContent;
  }

  [directiveTag](part: Part, updater: Updater): UnsafeHTMLBinding {
    if (part.type !== PartType.CHILD_NODE) {
      throw new Error(
        `${this.constructor.name} must be used in ChildNodePart.`,
      );
    }

    const binding = new UnsafeHTMLBinding(part, this);

    binding.bind(updater);

    return binding;
  }

  valueOf(): string {
    return this._unsafeContent;
  }
}

export class UnsafeHTMLBinding implements Binding<UnsafeHTMLDirective> {
  private readonly _part: ChildNodePart;

  private _directive: UnsafeHTMLDirective;

  private _childNodes: ChildNode[] = [];

  private _dirty = false;

  constructor(part: ChildNodePart, directive: UnsafeHTMLDirective) {
    this._part = part;
    this._directive = directive;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._childNodes[0] ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): UnsafeHTMLDirective {
    return this._directive;
  }

  set value(newDirective: UnsafeHTMLDirective) {
    this._directive = newDirective;
  }

  bind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    this._directive = new UnsafeHTMLDirective('');

    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  disconnect() {}

  commit() {
    const { unsafeContent } = this._directive;

    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }

    if (unsafeContent !== '') {
      const template = document.createElement('template');
      template.innerHTML = unsafeContent;

      const fragment = template.content;
      this._childNodes = [...fragment.childNodes];

      const reference = this._part.node;
      reference.before(fragment);
    }

    this._dirty = false;
  }
}
