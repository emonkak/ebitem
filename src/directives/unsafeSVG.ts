import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
} from '../binding.js';
import {
  type ChildNodePart,
  type Part,
  PartType,
  type Updater,
} from '../types.js';

export function unsafeSVG(content: string): UnsafeSVGDirective {
  return new UnsafeSVGDirective(content);
}

export class UnsafeSVGDirective implements Directive {
  private readonly _unsafeContent: string;

  constructor(unsafeContent: string) {
    this._unsafeContent = unsafeContent;
  }

  get unsafeContent(): string {
    return this._unsafeContent;
  }

  [directiveTag](part: Part, _updater: Updater): UnsafeSVGBinding {
    if (part.type !== PartType.ChildNode) {
      throw new Error('UnsafeSVGDirective must be used in ChildNodePart.');
    }
    return new UnsafeSVGBinding(this, part);
  }
}

export class UnsafeSVGBinding implements Binding<UnsafeSVGDirective> {
  private _directive: UnsafeSVGDirective;

  private readonly _part: ChildNodePart;

  private _childNodes: ChildNode[] = [];

  private _dirty = false;

  constructor(directive: UnsafeSVGDirective, part: ChildNodePart) {
    this._directive = directive;
    this._part = part;
  }

  get value(): UnsafeSVGDirective {
    return this._directive;
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

  connect(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  bind(newValue: UnsafeSVGDirective, updater: Updater): void {
    DEBUG: {
      ensureDirective(UnsafeSVGDirective, newValue);
    }
    const oldValue = this._directive;
    if (oldValue.unsafeContent !== newValue.unsafeContent) {
      this._directive = newValue;
      this.connect(updater);
    }
  }

  unbind(updater: Updater): void {
    const { unsafeContent } = this._directive;
    if (unsafeContent !== '') {
      this._directive = new UnsafeSVGDirective('');
      this.connect(updater);
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
      template.innerHTML = '<svg>' + unsafeContent + '</svg>';

      const fragment = template.content;
      this._childNodes = [...fragment.firstChild!.childNodes];

      const reference = this._part.node;
      reference.before(...this._childNodes);
    }

    this._dirty = false;
  }
}
