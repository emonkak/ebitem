import type { Part } from './part';
import type { Updater } from './updater';

export interface MountPoint {
  node: Node;
  parts: Part[];
}

export interface TemplateInterface {
  mount(values: unknown[], updater: Updater<unknown>): MountPoint;
  patch(
    parts: Part[],
    oldValues: unknown[],
    newValues: unknown[],
    updater: Updater<unknown>,
  ): void;
}
