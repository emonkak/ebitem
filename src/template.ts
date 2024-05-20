import type { ChildNodePart } from './binding.js';
import type { Updater } from './updater.js';

export interface Template<TData> {
  hydrate(data: TData, updater: Updater): TemplateRoot<TData>;
  sameTemplate(other: Template<TData>): boolean;
}

export interface TemplateRoot<TData> {
  get startNode(): ChildNode | null;
  get endNode(): ChildNode | null;
  bindData(data: TData, updater: Updater): void;
  unbindData(updater: Updater): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
  disconnect(): void;
}
