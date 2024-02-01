import { Directive, directiveSymbol } from '../directive';
import type { Part } from '../part';
import { AttributePart } from '../parts';
import type { Effect, Updater } from '../updater';

export type ClassMap = Map<string, boolean>;

export type ClassSpecifier = string | { [key: string]: boolean };

export class ClassList implements Directive {
  private readonly _classMap: ClassMap;

  constructor(classSpecifiers: ClassSpecifier[]) {
    this._classMap = classSpecifiers.reduce<ClassMap>((acc, classSpecifier) => {
      if (typeof classSpecifier === 'string') {
        acc.set(classSpecifier, true);
      } else {
        const classNames = Object.keys(classSpecifier);
        for (let i = 0, l = classNames.length; i < l; i++) {
          const className = classNames[i]!;
          acc.set(className, classSpecifier[className]!);
        }
      }
      return acc;
    }, new Map());
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
  private readonly _part: AttributePart;

  private readonly _classMap: ClassMap;

  constructor(part: AttributePart, classMap: ClassMap) {
    this._part = part;
    this._classMap = classMap;
  }

  commit(_updater: Updater): void {
    const { classList } = this._part.node;

    for (let i = 0, l = classList.length; i < l; i++) {
      const className = classList[i]!;

      if (!this._classMap.has(className)) {
        classList.remove(className);
      }
    }

    for (const [className, value] of this._classMap.entries()) {
      if (value) {
        classList.add(className);
      } else {
        classList.remove(className);
      }
    }
  }
}
