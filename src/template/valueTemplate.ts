import { type Binding, resolveBinding } from '../binding.js';
import {
  type ChildNodePart,
  PartType,
  type Template,
  type TemplateFragment,
  type Updater,
} from '../types.js';

export class ChildNodeTemplate<T> implements Template<T> {
  static instance: ChildNodeTemplate<any> = new ChildNodeTemplate<any>();

  private constructor() {
    if (ChildNodeTemplate.instance !== undefined) {
      throw new Error(
        'ChildNodeTemplate constructor cannot be called directly.',
      );
    }
  }

  hydrate(data: T, updater: Updater): ValueTemplateFragment<T> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const binding = resolveBinding(data, part, updater);
    binding.connect(updater);
    return new ValueTemplateFragment(binding);
  }

  isSameTemplate(other: Template<T>): boolean {
    return other === this;
  }
}

export class TextTemplate<T> implements Template<T> {
  static instance: TextTemplate<any> = new TextTemplate<any>();

  private constructor() {
    if (TextTemplate.instance !== undefined) {
      throw new Error('TextTemplate constructor cannot be called directly.');
    }
  }

  hydrate(data: T, updater: Updater): ValueTemplateFragment<T> {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const binding = resolveBinding(data, part, updater);
    binding.connect(updater);
    return new ValueTemplateFragment(binding);
  }

  isSameTemplate(other: Template<T>): boolean {
    return other === this;
  }
}

export class ValueTemplateFragment<T> implements TemplateFragment<T> {
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

  bind(newData: T, updater: Updater<unknown>): void {
    this._binding.bind(newData, updater);
  }

  unbind(updater: Updater): void {
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
