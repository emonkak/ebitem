import {
  Binding,
  Directive,
  directiveTag,
  ensureDirective,
} from '../binding.js';
import { AttributePart, Part, PartType } from '../part.js';
import type { Effect, Updater } from '../types.js';

export type StyleMap = { [P in StyleProperty]?: CSSStyleValue | string };

type StyleProperty = ExtractStringProperty<CSSStyleDeclaration>;

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

  [directiveTag](part: Part, _updater: Updater): StyleBinding {
    if (part.type !== PartType.Attribute || part.name !== 'style') {
      throw new Error('StyleDirective must be used in the "style" attribute.');
    }
    return new StyleBinding(this, part);
  }
}

export class StyleBinding implements Binding<StyleDirective>, Effect {
  private _directive: StyleDirective;

  private readonly _part: AttributePart;

  private _dirty = false;

  constructor(directive: StyleDirective, part: AttributePart) {
    this._directive = directive;
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

  get value(): StyleDirective {
    return this._directive;
  }

  bind(newValue: StyleDirective, updater: Updater): void {
    DEBUG: {
      ensureDirective(StyleDirective, newValue);
    }
    const oldValue = this._directive;
    if (!shallowEqual(newValue.styleMap, oldValue.styleMap)) {
      this._directive = newValue;
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
    const oldValue = this._directive;
    if (Object.keys(oldValue).length > 0) {
      this._directive = new StyleDirective({});
      this.rebind(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { attributeStyleMap } = this._part.node as
      | HTMLElement
      | MathMLElement
      | SVGElement;
    const { styleMap } = this._directive;

    for (const property in styleMap) {
      const value = styleMap[property as StyleProperty]!;
      attributeStyleMap.set(property, value);
    }

    for (const property of attributeStyleMap.keys()) {
      if (!Object.hasOwn(styleMap, property)) {
        attributeStyleMap.delete(property);
      }
    }
  }
}

function shallowEqual(
  first: { [key: string]: unknown },
  second: { [key: string]: unknown },
): boolean {
  if (first === second) {
    return true;
  }

  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);

  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  for (let i = 0; i < firstKeys.length; i++) {
    const key = firstKeys[i]!;
    if (!Object.hasOwn(second, key) || first[key] !== second[key]!) {
      return false;
    }
  }

  return true;
}
