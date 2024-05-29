import {
  Binding,
  Directive,
  directiveTag,
  ensureValueIsDirective,
} from '../binding.js';
import { AttributePart, Part, PartType } from '../part.js';
import type { Effect, Updater } from '../types.js';

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

  [directiveTag](part: Part, _updater: Updater): ClassNamesBinding {
    if (part.type !== PartType.Attribute || part.name !== 'class') {
      throw new Error(
        'ClassNamesDirective must be used in the "class" attribute.',
      );
    }
    return new ClassNamesBinding(this, part);
  }
}

export class ClassNamesBinding implements Effect, Binding<ClassNamesDirective> {
  private _value: ClassNamesDirective;

  private readonly _part: AttributePart;

  private _dirty = false;

  constructor(value: ClassNamesDirective, part: AttributePart) {
    this._value = value;
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

  get value(): ClassNamesDirective {
    return this._value;
  }

  bind(newValue: ClassNamesDirective, updater: Updater): void {
    DEBUG: {
      ensureValueIsDirective(newValue, ClassNamesDirective);
    }
    const oldClassSpecifiers = this._value.classSpecifiers;
    const newClassSpecifiers = newValue.classSpecifiers;
    if (
      newClassSpecifiers.length != oldClassSpecifiers.length &&
      newClassSpecifiers.some(
        (classSpecifier, index) => classSpecifier !== oldClassSpecifiers[index],
      )
    ) {
      this._value = newValue;
      this.rebind(updater);
    }
  }

  rebind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    const oldClassSpecifiers = this._value.classSpecifiers;
    if (oldClassSpecifiers.length > 0) {
      this._value = new ClassNamesDirective([]);
      this.rebind(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { classList } = this._part.node;
    const { classSpecifiers } = this._value;
    const addedClasses: string[] = [];

    for (let i = 0, l = classSpecifiers.length; i < l; i++) {
      const classSpecifier = classSpecifiers[i]!;
      if (typeof classSpecifier === 'string') {
        classList.add(classSpecifier);
        addedClasses.push(classSpecifier);
      } else {
        for (const className in classSpecifier) {
          const enabled = classSpecifier[className];
          classList.toggle(className, enabled);
          if (enabled) {
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
