import {
  AttributePart,
  Binding,
  Directive,
  Part,
  directiveTag,
} from '../part.js';
import type { Effect, Updater } from '../updater.js';

export type ClassSpecifier = string | { [key: string]: boolean };

export function classNames(
  ...classSpecifiers: ClassSpecifier[]
): ClassNamesDirective {
  return new ClassNamesDirective(classSpecifiers);
}

export class ClassNamesDirective implements Directive<ClassSpecifier[]> {
  private readonly _classSpecifiers: ClassSpecifier[];

  constructor(classSpecifiers: ClassSpecifier[]) {
    this._classSpecifiers = classSpecifiers;
  }

  [directiveTag](part: Part, updater: Updater): ClassNamesBinding {
    if (part.type !== 'attribute' || part.name !== 'class') {
      throw new Error(
        `${this.constructor.name} directive must be used in the "class" attribute.`,
      );
    }

    const binding = new ClassNamesBinding(part);

    binding.bind(this._classSpecifiers, updater);

    return binding;
  }

  valueOf(): ClassSpecifier[] {
    return this._classSpecifiers;
  }
}

export class ClassNamesBinding implements Effect, Binding<ClassSpecifier[]> {
  private readonly _part: AttributePart;

  private _classSpecifiers: ClassSpecifier[] = [];

  private _dirty = false;

  constructor(part: AttributePart) {
    this._part = part;
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

  bind(classSpecifiers: ClassSpecifier[], updater: Updater): void {
    this._classSpecifiers = classSpecifiers;

    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    this._classSpecifiers = [];

    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  disconnect(): void {}

  commit(): void {
    const { classList } = this._part.node;
    const addedClasses: string[] = [];

    for (let i = 0, l = this._classSpecifiers.length; i < l; i++) {
      const classSpecifier = this._classSpecifiers[i]!;
      if (typeof classSpecifier === 'string') {
        classList.add(classSpecifier);
        addedClasses.push(classSpecifier);
      } else {
        const classNames = Object.keys(classSpecifier);
        for (let i = 0, l = classNames.length; i < l; i++) {
          const className = classNames[i]!;
          classList.toggle(className, classSpecifier[className]);
        }
      }
    }

    if (addedClasses.length < classList.length) {
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
