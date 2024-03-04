import {
  AttributePart,
  Binding,
  Directive,
  Part,
  directiveTag,
} from '../part.js';
import type { Effect, Updater } from '../updater.js';

export type StyleMap = { [P in StyleProperty]?: string };

export type StyleProperty = ExtractStringProperty<CSSStyleDeclaration>;

type ExtractStringProperty<T> = {
  [P in keyof T]: P extends string ? (T[P] extends string ? P : never) : never;
}[keyof T];

export function style(styleDeclaration: StyleMap): StyleDirective {
  return new StyleDirective(styleDeclaration);
}

export class StyleDirective implements Directive<StyleMap> {
  private readonly _styleMap: StyleMap;

  constructor(styleMap: StyleMap) {
    this._styleMap = styleMap;
  }

  [directiveTag](part: Part, updater: Updater): StyleBinding {
    if (part.type !== 'attribute' || part.name !== 'style') {
      throw new Error(
        `${this.constructor.name} directive must be used in the "style" attribute.`,
      );
    }

    const binding = new StyleBinding(part);

    binding.bind(this._styleMap, updater);

    return binding;
  }

  valueOf(): StyleMap {
    return this._styleMap;
  }
}

export class StyleBinding implements Binding<StyleMap>, Effect {
  private readonly _part: AttributePart;

  private _styleMap = {} as StyleMap;

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

  bind(styleMap: StyleMap, updater: Updater): void {
    this._styleMap = styleMap;

    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    this._styleMap = {} as StyleMap;

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

    for (let i = 0, l = style.length; i < l; i++) {
      const property = style.item(i);

      if (!Object.hasOwn(this._styleMap, property)) {
        style.removeProperty(property);
      }
    }

    const newProperties = Object.keys(this._styleMap) as StyleProperty[];

    for (let i = 0, l = newProperties.length; i < l; i++) {
      const newProperty = newProperties[i]!;
      const newValue = this._styleMap[newProperty]!;

      style.setProperty(newProperty, newValue);
    }
  }
}
