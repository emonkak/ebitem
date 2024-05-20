import {
  Binding,
  ChildNodePart,
  PartType,
  initializeBinding,
  updateBinding,
} from '../binding.js';
import { Template, TemplateRoot } from '../template.js';
import { Updater } from '../updater.js';

export interface SlotData<TElementValue, TChildNodeValue> {
  elementValue: TElementValue;
  childNodeValue: TChildNodeValue;
}

export class SlotTemplate<TElementValue, TChildNodeValue>
  implements Template<SlotData<TElementValue, TChildNodeValue>>
{
  private readonly _type: string;

  constructor(type: string) {
    this._type = type;
  }

  hydrate(
    data: SlotData<TElementValue, TChildNodeValue>,
    updater: Updater<unknown>,
  ): SlotTemplateRoot<TElementValue, TChildNodeValue> {
    const { elementValue, childNodeValue } = data;
    const elementPart = {
      type: PartType.Element,
      node: document.createElement(this._type),
    } as const;
    const childNodePart = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const elementBinding = initializeBinding(
      elementValue,
      elementPart,
      updater,
    );
    const childNodeBinding = initializeBinding(
      childNodeValue,
      childNodePart,
      updater,
    );
    return new SlotTemplateRoot(elementBinding, childNodeBinding);
  }

  sameTemplate(
    other: Template<SlotData<TElementValue, TChildNodeValue>>,
  ): boolean {
    return other instanceof SlotTemplate && other._type === this._type;
  }
}

export class SlotTemplateRoot<TElementValue, TChildNodeValue>
  implements TemplateRoot<SlotData<TElementValue, TChildNodeValue>>
{
  private readonly _elementBinding: Binding<TElementValue>;

  private readonly _childNodeBinding: Binding<TChildNodeValue>;

  constructor(
    elementBinding: Binding<TElementValue>,
    childNodeBinding: Binding<TChildNodeValue>,
  ) {
    this._elementBinding = elementBinding;
    this._childNodeBinding = childNodeBinding;
  }

  get startNode(): ChildNode {
    return this._elementBinding.startNode;
  }

  get endNode(): ChildNode {
    return this._elementBinding.endNode;
  }

  bindData(
    newData: SlotData<TElementValue, TChildNodeValue>,
    updater: Updater<unknown>,
  ): void {
    updateBinding(this._elementBinding, newData.elementValue, updater);
    updateBinding(this._childNodeBinding, newData.childNodeValue, updater);
  }

  unbindData(updater: Updater): void {
    this._elementBinding.unbind(updater);
    this._childNodeBinding.unbind(updater);
  }

  mount(part: ChildNodePart): void {
    const referenceNode = part.node;
    const element = this._elementBinding.part.node;
    const childNode = this._childNodeBinding.part.node;

    element.appendChild(childNode);
    referenceNode.before(element);
  }

  unmount(part: ChildNodePart): void {
    const { parentNode } = part.node;

    if (parentNode !== null) {
      const element = this._elementBinding.part.node;
      const childNode = this._childNodeBinding.part.node;

      parentNode.removeChild(element);
      element.removeChild(childNode);
    }
  }

  disconnect(): void {
    this._elementBinding.disconnect();
    this._childNodeBinding.disconnect();
  }
}
