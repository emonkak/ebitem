import { Directive, directiveSymbol } from '../directive.js';
import type { Part } from '../part.js';
import { ChildPart, ChildValue } from '../part/child.js';
import type { Updater } from '../updater.js';

export function unsafeHTML(content: string): UnsafeHTML {
  return new UnsafeHTML(content);
}

export class UnsafeHTML implements Directive {
  private readonly _content: string;

  constructor(content: string) {
    this._content = content;
  }

  [directiveSymbol](part: Part, updater: Updater): void {
    if (!(part instanceof ChildPart)) {
      throw new Error(
        'UnsafeHTML directive must be used in an arbitrary child.',
      );
    }

    if (
      part.value instanceof UnsafeHTMLChild &&
      part.value.content === this._content
    ) {
      // Skip the update if the same content is given.
      return;
    }

    part.setValue(new UnsafeHTMLChild(this._content), updater);

    updater.enqueueMutationEffect(part);
  }
}

class UnsafeHTMLChild extends ChildValue {
  private readonly _content: string;

  private _startNode: ChildNode | null = null;

  private _endNode: ChildNode | null = null;

  get content(): string {
    return this._content;
  }

  constructor(content: string) {
    super();
    this._content = content;
  }

  get startNode(): ChildNode | null {
    return this._startNode;
  }

  get endNode(): ChildNode | null {
    return this._endNode;
  }

  onMount(part: ChildPart, _updater: Updater): void {
    const range = document.createRange();
    const fragment = range.createContextualFragment(this._content);
    const reference = part.endNode;

    this._startNode = fragment.firstChild;
    this._endNode = fragment.lastChild;

    reference.parentNode!.insertBefore(reference, fragment);
  }

  onUnmount(_part: ChildPart, _updater: Updater): void {
    let node = this._startNode;

    while (node !== null) {
      node.remove();
      if (node === this._endNode) {
        break;
      }
      node = node.nextSibling;
    }

    this._startNode = null;
    this._endNode = null;
  }

  onUpdate(_part: ChildPart, _updater: Updater): void {}
}
