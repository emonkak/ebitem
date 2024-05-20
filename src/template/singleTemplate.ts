import {
  Binding,
  ChildNodePart,
  PartType,
  createBinding,
  updateBinding,
} from '../binding.js';
import { Template, TemplateRoot } from '../template.js';
import { Updater } from '../updater.js';

export class ChildNodeTemplate<T> implements Template<T> {
  static instance: ChildNodeTemplate<any> = new ChildNodeTemplate<any>();

  private constructor() {
    if (ChildNodeTemplate.instance !== undefined) {
      throw new Error(
        'ChildNodeTemplate constructor cannot be called directly.',
      );
    }
  }

  hydrate(data: T, updater: Updater): SingleTemplateRoot<T> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const binding = createBinding(data, part, updater);
    return new SingleTemplateRoot(binding);
  }

  sameTemplate(other: Template<T>): boolean {
    return other instanceof ChildNodeTemplate;
  }
}

export class TextTemplate<T> implements Template<T> {
  static instance: TextTemplate<any> = new TextTemplate<any>();

  private constructor() {
    if (TextTemplate.instance !== undefined) {
      throw new Error(
        'SingleTextTemplate constructor cannot be called directly.',
      );
    }
  }

  hydrate(data: T, updater: Updater): SingleTemplateRoot<T> {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const binding = createBinding(data, part, updater);
    return new SingleTemplateRoot(binding);
  }

  sameTemplate(other: Template<T>): boolean {
    return other instanceof TextTemplate;
  }
}

export class SingleTemplateRoot<T> implements TemplateRoot<T> {
  private readonly _binding: Binding<T>;

  constructor(binding: Binding<T>) {
    this._binding = binding;
  }

  get startNode(): ChildNode {
    return this._binding.startNode;
  }

  get endNode(): ChildNode {
    return this._binding.endNode;
  }

  bindData(newData: T, updater: Updater<unknown>): void {
    updateBinding(this._binding, newData, updater);
  }

  unbindData(updater: Updater): void {
    this._binding.unbind(updater);
  }

  mount(part: ChildNodePart): void {
    const referenceNode = part.node;

    referenceNode.before(this._binding.part.node);
  }

  unmount(part: ChildNodePart): void {
    const { parentNode } = part.node;

    if (parentNode !== null) {
      parentNode.removeChild(this._binding.part.node);
    }
  }

  disconnect(): void {
    this._binding.disconnect();
  }
}
