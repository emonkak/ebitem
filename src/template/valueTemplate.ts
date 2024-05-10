import {
  Binding,
  ChildNodePart,
  NodeBinding,
  PartType,
  directiveTag,
  isDirective,
  updateBinding,
} from '../binding.js';
import { Template, TemplateRoot } from '../template.js';
import { Updater } from '../updater.js';

export class ValueTemplate implements Template {
  static instance: ValueTemplate = new ValueTemplate();

  private constructor() {}

  hydrate(values: unknown[], updater: Updater<unknown>): ValueTemplateRoot {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const bindings = values.map((value) => {
      if (isDirective(value)) {
        const part = {
          type: PartType.ChildNode,
          node: document.createComment(''),
        } as const;
        return value[directiveTag](part, updater);
      } else {
        const part = {
          type: PartType.Node,
          node: document.createTextNode(''),
        } as const;
        const binding = new NodeBinding(value, part);
        binding.bind(updater);
        return binding;
      }
    });
    return new ValueTemplateRoot(bindings, part);
  }
}

export class ValueTemplateRoot implements TemplateRoot {
  private readonly _part: ChildNodePart;

  private _bindings: Binding<unknown>[];

  constructor(bindings: Binding<unknown>[], part: ChildNodePart) {
    this._bindings = bindings;
    this._part = part;
  }

  get startNode(): ChildNode | null {
    return this._bindings[0]?.startNode ?? null;
  }

  get endNode(): ChildNode | null {
    return this._bindings.at(-1)?.endNode ?? null;
  }

  bindValues(newValues: unknown[], updater: Updater<unknown>): void {
    if (newValues.length !== this._bindings.length) {
      throw new Error(
        `The number of new values must be ${this._bindings.length}, but got ${newValues.length}.`,
      );
    }

    for (let i = 0, l = this._bindings.length; i < l; i++) {
      updateBinding(this._bindings[i]!, newValues[i]!, updater);
    }
  }

  unbindValues(updater: Updater): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.unbind(updater);
    }
  }

  mount(part: ChildNodePart): void {
    const referenceNode = part.node;

    for (let i = 0, l = this._bindings.length; i < l; i++) {
      const binding = this._bindings[i]!;
      referenceNode.before(binding.part.node);
    }
  }

  unmount(part: ChildNodePart): void {
    const { parentNode } = part.node;

    if (parentNode !== null) {
      for (let i = 0, l = this._bindings.length; i < l; i++) {
        const binding = this._bindings[i]!;
        parentNode.removeChild(binding.part.node);
      }

      parentNode.removeChild(this._part.node);
    }
  }

  disconnect(): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.disconnect();
    }
  }
}
