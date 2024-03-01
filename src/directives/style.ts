import type { Context } from '../context.js';
import { Directive, directiveTag } from '../directive.js';
import type { Part } from '../part.js';
import { AttributePart } from '../part/attribute.js';
import type { Effect, Updater } from '../updater.js';

export type Style = Record<StyleProperty, string>;

export type StyleProperty = ExtractStringProperty<CSSStyleDeclaration>;

type ExtractStringProperty<T> = {
  [P in keyof T]: P extends string ? (T[P] extends string ? P : never) : never;
}[keyof T];

export function style(styleDeclaration: Style): StyleDirective {
  return new StyleDirective(styleDeclaration);
}

export class StyleDirective implements Directive<Context> {
  private readonly _style: Style;

  constructor(style: Style) {
    this._style = style;
  }

  [directiveTag](
    _context: Context,
    part: Part,
    updater: Updater<unknown>,
  ): void {
    if (!(part instanceof AttributePart) || part.name !== 'style') {
      throw new Error('Style directive must be used in the "style" attribute.');
    }

    updater.enqueueMutationEffect(new UpdateStyle(part, this._style));
  }
}

class UpdateStyle implements Effect {
  private readonly _part: AttributePart;

  private readonly _style: Style;

  constructor(part: AttributePart, style: Style) {
    this._part = part;
    this._style = style;
  }

  commit(_updater: Updater): void {
    const { style } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;

    for (let i = 0, l = style.length; i < l; i++) {
      const property = style.item(i);

      if (!Object.hasOwn(this._style, property)) {
        style.removeProperty(property);
      }
    }

    const newProperties = Object.keys(this._style) as StyleProperty[];

    for (let i = 0, l = newProperties.length; i < l; i++) {
      const newProperty = newProperties[i]!;
      const newValue = this._style[newProperty]!;

      style.setProperty(newProperty, newValue);
    }
  }
}
