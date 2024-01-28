import { Directive, directiveSymbol } from '../directive';
import { Part } from '../part';
import { AttributePart } from '../parts';
import type { Updater } from '../updater';

export type ClassSpecifier = string | { [key: string]: boolean };

export class ClassList implements Directive {
  private readonly _classSpecifiers: ClassSpecifier[];

  constructor(classSpecifiers: ClassSpecifier[]) {
    this._classSpecifiers = classSpecifiers;
  }

  [directiveSymbol](part: Part, _updater: Updater<unknown>): void {
    if (!(part instanceof AttributePart) || part.name !== 'class') {
      throw new Error(
        '"ClassList" directive must be used in the "class" attribute.',
      );
    }

    const { classList } = part.node;

    for (let i = 0, l = this._classSpecifiers.length; i < l; i++) {
      const classSpecifier = this._classSpecifiers[i];
      if (typeof classSpecifier === 'string') {
        classList.add(classSpecifier);
      } else {
        for (const className in classSpecifier) {
          if (classSpecifier[className]) {
            classList.add(className);
          } else {
            classList.remove(className);
          }
        }
      }
    }
  }
}

export function classList(...classSpecifiers: ClassSpecifier[]): ClassList {
  return new ClassList(classSpecifiers);
}
