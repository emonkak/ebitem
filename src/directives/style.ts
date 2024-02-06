import { Directive, directiveSymbol } from '../directive.js';
import type { Part } from '../part.js';
import { AttributePart } from '../parts.js';
import type { Effect, Updater } from '../updater.js';

type ExtractStringProperty<T> = {
  [P in keyof T]: P extends string ? (T[P] extends string ? P : never) : never;
}[keyof T];

export type StyleProperty = ExtractStringProperty<CSSStyleDeclaration>;

export type StyleDeclaration = Record<StyleProperty, string>;

export function style(styleDeclaration: StyleDeclaration): Style {
  return new Style(styleDeclaration);
}

export class Style implements Directive {
  private readonly _styleDeclaration: StyleDeclaration;

  constructor(styleDeclaration: StyleDeclaration) {
    this._styleDeclaration = styleDeclaration;
  }

  [directiveSymbol](part: Part, updater: Updater): void {
    if (!(part instanceof AttributePart) || part.name !== 'style') {
      throw new Error(
        '"Style" directive must be used in the "style" attribute.',
      );
    }

    updater.pushMutationEffect(new UpdateStyle(part, this._styleDeclaration));
  }
}

class UpdateStyle implements Effect {
  private readonly _part: AttributePart;

  private readonly _styleDeclaration: StyleDeclaration;

  constructor(part: AttributePart, styleDeclaration: StyleDeclaration) {
    this._part = part;
    this._styleDeclaration = styleDeclaration;
  }

  commit(_updater: Updater): void {
    const { style } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;

    for (let i = 0, l = style.length; i < l; i++) {
      const property = style.item(i);

      if (!Object.hasOwn(this._styleDeclaration, property)) {
        style.removeProperty(property);
      }
    }

    const newProperties = Object.keys(
      this._styleDeclaration,
    ) as StyleProperty[];

    for (let i = 0, l = newProperties.length; i < l; i++) {
      const newProperty = newProperties[i]!;
      const newValue = this._styleDeclaration[newProperty]!;

      style.setProperty(newProperty, newValue);
    }
  }
}
