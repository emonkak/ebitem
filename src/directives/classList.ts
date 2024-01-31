import { Directive, directiveSymbol } from '../directive';
import type { Part } from '../part';
import { AttributePart } from '../parts';
import type { Effect, Updater } from '../updater';

export type ClassMap = { [key: string]: boolean };

export type ClassSpecifier = string | ClassMap;

export class ClassList implements Directive {
  private readonly _classMap: ClassMap;

  constructor(classSpecifiers: ClassSpecifier[]) {
    this._classMap = classSpecifiers.reduce<ClassMap>((acc, classSpecifier) => {
      if (typeof classSpecifier === 'string') {
        acc[classSpecifier] = true;
      } else {
        Object.assign(acc, classSpecifier);
      }
      return acc;
    }, {});
  }

  [directiveSymbol](part: Part, updater: Updater): void {
    if (!(part instanceof AttributePart) || part.name !== 'class') {
      throw new Error(
        '"ClassList" directive must be used in the "class" attribute.',
      );
    }

    updater.pushMutationEffect(new UpdateClassList(part, this._classMap));
  }
}

class UpdateClassList implements Effect {
  private _part: AttributePart;

  private _classMap: ClassMap;

  constructor(part: AttributePart, classMap: ClassMap) {
    this._part = part;
    this._classMap = classMap;
  }

  commit(_updater: Updater): void {
    const { classList } = this._part.node;

    for (let i = 0, l = classList.length; i < l; i++) {
      const className = classList[i]!;

      if (
        Object.hasOwn(this._classMap, className) &&
        !this._classMap[className]
      ) {
        classList.remove(className);
      }
    }

    const newClassNames = Object.keys(this._classMap);

    for (let i = 0, l = newClassNames.length; i < l; i++) {
      const newClassName = newClassNames[i]!;

      if (this._classMap[newClassName]) {
        classList.add(newClassName);
      } else {
        classList.remove(newClassName);
      }
    }
  }
}
