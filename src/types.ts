import type { Context } from './context';

export type Cleanup = (context: Context) => void;

export interface Effect {
  commit(context: Context): void;
}

export type EffectCallback = () => void | Cleanup;

export interface MountPoint {
  node: Node;
  parts: Part[];
}

export interface Part<T = unknown> extends Effect {
  get value(): T | null;
  get node(): ChildNode;
  setValue(newValue: unknown): void;
  disconnect(context: Context): void;
}

export interface Ref<T> {
  current: T;
}

export type RefCallback<T> = (value: T) => void;

export interface Renderable {
  get isDirty(): boolean;
  get parent(): Renderable | null;
  render(context: Context): void;
}

export interface TemplateInterface {
  mount(values: unknown[], context: Context): MountPoint;
  patch(
    parts: Part[],
    oldValues: unknown[],
    newValues: unknown[],
    context: Context,
  ): void;
}
