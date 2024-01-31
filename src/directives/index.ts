import type { Context } from '../context';
import type { Ref } from '../hook';
import type { TemplateResult } from '../templateResult';
import { Block } from './block';
import { ClassList, ClassSpecifier } from './classList';
import { DOMRef } from './domRef';
import { List } from './list';
import { Style, StyleDeclaration } from './style';

export function block<TProps, TContext = Context>(
  type: (props: TProps, context: TContext) => TemplateResult,
  props: TProps,
): Block<TProps, TContext> {
  return new Block(type, props);
}

export function classList(...classSpecifiers: ClassSpecifier[]): ClassList {
  return new ClassList(classSpecifiers);
}

export function domRef(ref: Ref<Element | null>) {
  return new DOMRef(ref);
}

export function list<TItem>(items: TItem[]): List<TItem, TItem, number>;
export function list<TItem, TValue>(
  items: TItem[],
  valueSelector: (item: TItem, index: number) => TValue,
): List<TItem, TValue, number>;
export function list<TItem, TValue, TKey>(
  items: TItem[],
  valueSelector: (item: TItem, index: number) => TValue,
  keySelector: (item: TItem, index: number) => TKey,
): List<TItem, TValue, number>;
export function list<TItem, TValue, TKey>(
  items: TItem[],
  valueSelector: (item: TItem, index: number) => TValue = (
    item: any,
    _index: any,
  ) => item,
  keySelector: (item: TItem, index: number) => TKey = (
    _item: any,
    index: any,
  ) => index,
): List<TItem, TValue, TKey> {
  return new List(items, valueSelector, keySelector);
}

export function style(styleDeclaration: StyleDeclaration): Style {
  return new Style(styleDeclaration);
}
