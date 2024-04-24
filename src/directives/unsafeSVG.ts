import {
  Binding,
  ChildNodePart,
  Directive,
  Part,
  PartType,
  Updater,
  directiveTag,
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

  [directiveTag](part: Part, updater: Updater): UnsafeSVGBinding {
    if (part.type !== PartType.CHILD_NODE) {
      throw new Error('UnsafeSVGDirective must be used in ChildNodePart.');
    }

    const binding = new UnsafeSVGBinding(this, part);

    binding.bind(updater);

    return binding;
  }
}

export class UnsafeSVGBinding implements Binding<UnsafeSVGDirective> {
  private readonly _part: ChildNodePart;

  private _directive: UnsafeSVGDirective;

  private _childNodes: ChildNode[] = [];

  private _dirty = false;

  constructor(directive: UnsafeSVGDirective, part: ChildNodePart) {
    this._directive = directive;
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

  get value(): UnsafeSVGDirective {
    return this._directive;
  }

  set value(newValue: UnsafeSVGDirective) {
    this._directive = newValue;
  }

  bind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    this._directive = new UnsafeSVGDirective('');

    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  disconnect(): void {}

  commit(): void {
    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }

    const { unsafeContent } = this._directive;

    if (unsafeContent !== '') {
      const template = document.createElement('template');
      template.innerHTML = '<svg>' + unsafeContent + '</svg>';

      const fragment = template.content;
      this._childNodes = [...fragment.firstChild!.childNodes];
      fragment.replaceChildren(...this._childNodes);

      const reference = this._part.node;
      reference.before(fragment);
    }

    this._dirty = false;
  }
}
