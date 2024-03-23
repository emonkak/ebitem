import { Binding, Directive, directiveTag } from '../binding.js';
import { AttributePart, Effect, Part, PartType, Updater } from '../types.js';

export type ClassSpecifier = string | { [key: string]: boolean };

export function classNames(
  ...classSpecifiers: ClassSpecifier[]
): ClassNamesDirective {
  return new ClassNamesDirective(classSpecifiers);
}

export class ClassNamesDirective implements Directive {
  private readonly _classSpecifiers: ClassSpecifier[];

  constructor(classSpecifiers: ClassSpecifier[]) {
    this._classSpecifiers = classSpecifiers;
  }

  get classSpecifiers(): ClassSpecifier[] {
    return this._classSpecifiers;
  }

  [directiveTag](part: Part, updater: Updater): ClassNamesBinding {
    if (part.type !== PartType.ATTRIBUTE || part.name !== 'class') {
      throw new Error(
        `${this.constructor.name} directive must be used in the "class" attribute.`,
      );
    }

    const binding = new ClassNamesBinding(part, this);

    binding.bind(updater);

    return binding;
  }
}

export class ClassNamesBinding implements Effect, Binding<ClassNamesDirective> {
  private readonly _part: AttributePart;

  private _directive: ClassNamesDirective;

  private _dirty = false;

  constructor(part: AttributePart, directive: ClassNamesDirective) {
    this._part = part;
    this._directive = directive;
  }

  get part(): AttributePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): ClassNamesDirective {
    return this._directive;
  }

  set value(newDirective: ClassNamesDirective) {
    this._directive = newDirective;
  }

  bind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    this._directive = new ClassNamesDirective([]);

    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  disconnect(): void {}

  commit(): void {
    const { classList } = this._part.node;
    const { classSpecifiers } = this._directive;
    const addedClasses: string[] = [];

    for (let i = 0, l = classSpecifiers.length; i < l; i++) {
      const classSpecifier = classSpecifiers[i]!;
      if (typeof classSpecifier === 'string') {
        classList.add(classSpecifier);
        addedClasses.push(classSpecifier);
      } else {
        const classNames = Object.keys(classSpecifier);
        for (let i = 0, l = classNames.length; i < l; i++) {
          const className = classNames[i]!;
          classList.toggle(className, classSpecifier[className]);
          if (classSpecifier[className]) {
            addedClasses.push(className);
          }
        }
      }
    }

    if (addedClasses.length === 0) {
      classList.value = '';
    } else if (addedClasses.length < classList.length) {
      for (let i = classList.length - 1; i >= 0; i--) {
        const className = classList[i]!;
        if (!addedClasses.includes(className)) {
          classList.remove(className);
        }
      }
    }

    this._dirty = false;
  }
}
