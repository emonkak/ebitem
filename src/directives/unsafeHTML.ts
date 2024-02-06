import { Directive, directiveSymbol } from '../directive.js';
import type { Part } from '../part.js';
import { ChildPart, ChildValue } from '../parts.js';
import type { Updater } from '../updater.js';

export function unsafeHTML(html: string): UnsafeHTML {
  return new UnsafeHTML(html);
}

export class UnsafeHTML implements Directive {
  private readonly _html: string;

  constructor(html: string) {
    this._html = html;
  }

  [directiveSymbol](part: Part, updater: Updater): void {
    if (!(part instanceof ChildPart)) {
      throw new Error(
        '"UnsafeHTML" directive must be used in an arbitrary child.',
      );
    }

    if (
      part.value instanceof UnsafeHTMLChild &&
      part.value.html === this._html
    ) {
      // Skip the update if the same HTML is given.
      return;
    }

    part.setValue(new UnsafeHTMLChild(this._html));

    updater.pushMutationEffect(part);
  }
}

class UnsafeHTMLChild extends ChildValue {
  private readonly _html: string;

  private _startNode: ChildNode | null = null;

  private _endNode: ChildNode | null = null;

  get html(): string {
    return this._html;
  }

  constructor(html: string) {
    super();
    this._html = html;
  }

  get startNode(): ChildNode | null {
    return this._startNode;
  }

  get endNode(): ChildNode | null {
    return this._endNode;
  }

  mount(part: ChildPart, _updater: Updater): void {
    const { endNode } = part;
    const range = document.createRange();
    const fragment = range.createContextualFragment(this._html);

    this._startNode = fragment.firstChild;
    this._endNode = fragment.lastChild;

    endNode.parentNode?.insertBefore(endNode, fragment);
  }

  unmount(_part: ChildPart, _updater: Updater): void {
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

  update(_part: ChildPart, _updater: Updater): void {}
}
