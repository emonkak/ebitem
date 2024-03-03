import { Part, PartChild, mountPart, updatePart } from './part.js';
import { ChildPart } from './part/child.js';
import { ElementPart, ElementProps } from './part/element.js';
import type { Updater } from './updater.js';

export class Slot extends PartChild {
  private readonly _elementPart: ElementPart;

  private readonly _childPart: ChildPart;

  private _memoizedElementProps: ElementProps | null = null;

  private _memoizedChildValue: unknown = null;

  constructor(type: string) {
    super();

    const element = document.createElement(type);
    const marker = document.createComment('');
    const elementPart = new ElementPart(element);
    const childPart = new ChildPart(marker);

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

  connectParts(
    elementProps: ElementProps,
    childValue: unknown,
    updater: Updater,
  ) {
    mountPart(this.elementPart, elementProps, updater);
    mountPart(this.childPart, childValue, updater);

    this._memoizedElementProps = elementProps;
    this._memoizedChildValue = childValue;
  }

  updateParts(
    newElementProps: ElementProps,
    newChildValue: unknown,
    updater: Updater,
  ) {
    updatePart(
      this.elementPart,
      this._memoizedElementProps,
      newElementProps,
      updater,
    );
    updatePart(
      this.childPart,
      this._memoizedChildValue,
      newChildValue,
      updater,
    );

    this._memoizedElementProps = newElementProps;
    this._memoizedChildValue = newChildValue;
  }

  mount(part: Part, _updater: Updater): void {
    const reference = part.node;
    reference.parentNode?.insertBefore(this._elementPart.node, reference);
  }

  unmount(part: Part, _updater: Updater): void {
    part.node.parentNode?.removeChild(this._elementPart.node);
  }
}
