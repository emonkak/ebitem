import { Directive, directiveTag } from '../directive.js';
import { Part, PartChild } from '../part.js';
import { ChildPart } from '../part/child.js';
import type { Updater } from '../updater.js';

export function unsafeSVG(content: string): UnsafeSVGDirective {
  return new UnsafeSVGDirective(content);
}

export class UnsafeSVGDirective implements Directive<unknown> {
  private readonly _content: string;

  constructor(content: string) {
    this._content = content;
  }

  [directiveTag](_context: unknown, part: Part, updater: Updater): void {
    if (!(part instanceof ChildPart)) {
      throw new Error(
        'UnsafeSVG directive must be used in an arbitrary child.',
      );
    }

    part.value = new UnsafeSVG(this._content);

    updater.enqueueMutationEffect(part);
  }
}

class UnsafeSVG extends PartChild {
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
    template.innerHTML = `<svg>${this._content}</svg>`;

    const fragment = template.content;
    fragment.replaceChildren(...fragment.firstChild!.childNodes);
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
}
