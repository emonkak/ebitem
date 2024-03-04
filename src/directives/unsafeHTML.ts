import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  directiveTag,
} from '../part.js';
import type { Updater } from '../updater.js';

export function unsafeHTML(content: string): UnsafeHTMLDirective {
  return new UnsafeHTMLDirective(content);
}

export class UnsafeHTMLDirective implements Directive<unknown> {
  private readonly _unsafeContent: string;

  constructor(unsafeContent: string) {
    this._unsafeContent = unsafeContent;
  }

  [directiveTag](part: Part, updater: Updater): UnsafeHTMLBinding {
    if (part.type !== 'childNode') {
      throw new Error(
        `${this.constructor.name} must be used in ChildNodePart.`,
      );
    }

    const binding = new UnsafeHTMLBinding(part);

    binding.bind(this._unsafeContent, updater);

    return binding;
  }

  valueOf(): string {
    return this._unsafeContent;
  }
}

export class UnsafeHTMLBinding implements Binding<string> {
  private readonly _part: ChildNodePart;

  private _unsafeContent = '';

  private _childNodes: ChildNode[] = [];

  private _dirty = false;

  constructor(part: ChildNodePart) {
    this._part = part;
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

  bind(unsafeContent: string, updater: Updater): void {
    this._unsafeContent = unsafeContent;

    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    this._unsafeContent = '';

    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  disconnect() {}

  commit() {
    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }

    if (this._unsafeContent !== '') {
      const template = document.createElement('template');
      template.innerHTML = this._unsafeContent;

      const fragment = template.content;
      this._childNodes = [...fragment.childNodes];

      const reference = this._part.node;
      reference.before(fragment);
    }

    this._dirty = false;
  }
}
