import { Binding, Directive, directiveTag } from '../binding.js';
import { AttributePart, Effect, Part, PartType, Updater } from '../types.js';

export type StyleMap = { [P in StyleProperty]?: string };

export type StyleProperty = ExtractStringProperty<CSSStyleDeclaration>;

type ExtractStringProperty<T> = {
  [P in keyof T]: P extends string ? (T[P] extends string ? P : never) : never;
}[keyof T];

export function style(styleDeclaration: StyleMap): StyleDirective {
  return new StyleDirective(styleDeclaration);
}

export class StyleDirective implements Directive {
  private readonly _styleMap: StyleMap;

  constructor(styleMap: StyleMap) {
    this._styleMap = styleMap;
  }

  get styleMap(): StyleMap {
    return this._styleMap;
  }

  [directiveTag](part: Part, updater: Updater): StyleBinding {
    if (part.type !== PartType.ATTRIBUTE || part.name !== 'style') {
      throw new Error(
        `${this.constructor.name} directive must be used in the "style" attribute.`,
      );
    }

    const binding = new StyleBinding(part, this);

    binding.bind(updater);

    return binding;
  }

  valueOf(): StyleMap {
    return this._styleMap;
  }
}

export class StyleBinding implements Binding<StyleDirective>, Effect {
  private readonly _part: AttributePart;

  private _directive: StyleDirective;

  private _dirty = false;

  constructor(part: AttributePart, directive: StyleDirective) {
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

  get value(): StyleDirective {
    return this._directive;
  }

  set value(newValue: StyleDirective) {
    this._directive = newValue;
  }

  bind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    this._directive = new StyleDirective({});

    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  disconnect() {}

  commit() {
    const { style } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;
    const { styleMap } = this._directive;

    for (let i = 0, l = style.length; i < l; i++) {
      const property = style.item(i);

      if (!Object.hasOwn(styleMap, property)) {
        style.removeProperty(property);
      }
    }

    const newProperties = Object.keys(styleMap) as StyleProperty[];

    for (let i = 0, l = newProperties.length; i < l; i++) {
      const newProperty = newProperties[i]!;
      const newValue = styleMap[newProperty]!;

      style.setProperty(newProperty, newValue);
    }
  }
}
