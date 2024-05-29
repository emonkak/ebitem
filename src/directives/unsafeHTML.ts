import {
  Binding,
  Directive,
  directiveTag,
  ensureDirective,
} from '../binding.js';
import { ChildNodePart, Part, PartType } from '../part.js';
import type { Updater } from '../types.js';

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

  [directiveTag](part: Part, _updater: Updater): UnsafeHTMLBinding {
    if (part.type !== PartType.ChildNode) {
      throw new Error('UnsafeHTMLDirective must be used in ChildNodePart.');
    }
    return new UnsafeHTMLBinding(this, part);
  }
}

export class UnsafeHTMLBinding implements Binding<UnsafeHTMLDirective> {
  private _directive: UnsafeHTMLDirective;

  private readonly _part: ChildNodePart;

  private _childNodes: ChildNode[] = [];

  private _dirty = false;

  constructor(_value: UnsafeHTMLDirective, part: ChildNodePart) {
    this._directive = _value;
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

  get value(): UnsafeHTMLDirective {
    return this._directive;
  }

  bind(newValue: UnsafeHTMLDirective, updater: Updater): void {
    DEBUG: {
      ensureDirective(UnsafeHTMLDirective, newValue);
    }
    const oldValue = this._directive;
    if (oldValue.unsafeContent !== newValue.unsafeContent) {
      this._directive = newValue;
      this.rebind(updater);
    }
  }

  rebind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    const { unsafeContent } = this._directive;
    if (unsafeContent !== '') {
      this._directive = new UnsafeHTMLDirective('');
      this.rebind(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
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
