import { Directive, directiveSymbol } from '../directive.js';
import type { Part } from '../part.js';
import { AttributePart } from '../part/attribute.js';
import type { Effect, Updater } from '../updater.js';

export type ClassMap = Map<string, boolean>;

export type ClassSpecifier = string | { [key: string]: boolean };

export function classList(...classSpecifiers: ClassSpecifier[]): ClassList {
  return new ClassList(classSpecifiers);
}

export class ClassList implements Directive {
  private readonly _classSpecifiers: ClassSpecifier[];

  constructor(classSpecifiers: ClassSpecifier[]) {
    this._classSpecifiers = classSpecifiers;
  }

  [directiveSymbol](part: Part, updater: Updater): void {
    if (!(part instanceof AttributePart) || part.name !== 'class') {
      throw new Error(
        '"ClassList" directive must be used in the "class" attribute.',
      );
    }

    updater.enqueueMutationEffect(
      new UpdateClassList(part, this._classSpecifiers),
    );
  }
}

class UpdateClassList implements Effect {
  private readonly _part: AttributePart;

  private readonly _classSpecifiers: ClassSpecifier[];

  constructor(part: AttributePart, classSpecifiers: ClassSpecifier[]) {
    this._part = part;
    this._classSpecifiers = classSpecifiers;
  }

  commit(_updater: Updater): void {
    const { classList } = this._part.node;
    const visitedClasses: string[] = [];

    for (let i = 0, l = this._classSpecifiers.length; i < l; i++) {
      const classSpecifier = this._classSpecifiers[i]!;
      if (typeof classSpecifier === 'string') {
        classList.add(classSpecifier);
        visitedClasses.push(classSpecifier);
      } else {
        const names = Object.keys(classSpecifier);
        for (let i = 0, l = names.length; i < l; i++) {
          const name = names[i]!;
          if (classSpecifier[name]) {
            classList.add(name);
            visitedClasses.push(name);
          } else {
            classList.remove(name);
          }
        }
      }
    }

    if (visitedClasses.length < classList.length) {
      for (let i = 0, l = classList.length; i < l; i++) {
        const name = classList[i]!;
        if (!visitedClasses.includes(name)) {
          classList.remove(name);
        }
      }
    }
  }
}
