import { Part, PartChild } from './part.js';
import { ChildPart } from './part/child.js';
import { ElementPart, ElementProps } from './part/element.js';
import { Updater } from './updater.js';

export class Slot extends PartChild {
  private readonly _elementPart: ElementPart;

  private readonly _childPart: ChildPart;

  constructor(type: string, elementProps: ElementProps, childValue: unknown) {
    super();

    const element = document.createElement(type);
    const marker = document.createComment('');
    const elementPart = new ElementPart(element);
    const childPart = new ChildPart(marker);

    elementPart.value = elementProps;
    childPart.value = childValue;

    element.appendChild(marker);

    this._elementPart = elementPart;
    this._childPart = childPart;
  }

  get startNode(): ChildNode | null {
    return this._elementPart.node;
  }

  get endNode(): ChildNode | null {
    return this._elementPart.node;
  }

  get type(): string {
    return this._elementPart.node.tagName;
  }

  get elementPart(): ElementPart {
    return this._elementPart;
  }

  get childPart(): ChildPart {
    return this._childPart;
  }

  mount(part: Part, _updater: Updater): void {
    const reference = part.node;
    reference.parentNode?.insertBefore(this._elementPart.node, reference);
  }

  unmount(part: Part, _updater: Updater): void {
    part.node.parentNode?.removeChild(this._elementPart.node);
  }

  commit(updater: Updater): void {
    this._elementPart.commit(updater);
    this._childPart.commit(updater);
  }
}
