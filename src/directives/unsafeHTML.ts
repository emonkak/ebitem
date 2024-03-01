import { Directive, directiveTag } from '../directive.js';
import { Part, PartChild } from '../part.js';
import { ChildPart } from '../part/child.js';
import type { Updater } from '../updater.js';

export function unsafeHTML(content: string): UnsafeHTMLDirective {
  return new UnsafeHTMLDirective(content);
}

export class UnsafeHTMLDirective implements Directive<unknown> {
  private readonly _content: string;

  constructor(content: string) {
    this._content = content;
  }

  [directiveTag](_context: unknown, part: Part, updater: Updater): void {
    if (!(part instanceof ChildPart)) {
      throw new Error(
        'UnsafeHTML directive must be used in an arbitrary child.',
      );
    }

    part.value = new UnsafeHTML(this._content);

    updater.enqueueMutationEffect(part);
  }
}

class UnsafeHTML extends PartChild {
  private readonly _content: string;

  private _startNode: ChildNode | null = null;

  private _endNode: ChildNode | null = null;

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

  mount(part: Part, _updater: Updater): void {
    const template = document.createElement('template');
    template.innerHTML = this._content;

    const fragment = template.content;
    this._startNode = fragment.firstChild;
    this._endNode = fragment.lastChild;

    const reference = part.node;
    reference.parentNode?.insertBefore(fragment, reference);
  }

  unmount(part: Part, _updater: Updater): void {
    const { parentNode } = part.node;

    if (parentNode !== null) {
      let currentNode = this._startNode;

      while (currentNode !== null) {
        const nextNode = currentNode.nextSibling;
        parentNode.removeChild(currentNode);
        if (currentNode === this._endNode) {
          break;
        }
        currentNode = nextNode;
      }
    }
  }

  commit(_updater: Updater): void {}
}
