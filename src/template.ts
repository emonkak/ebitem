import type { Context } from './context';
import {
  AttributePart,
  ChildPart,
  EventPart,
  mountPart,
  updatePart,
} from './part';
import type { Cleanup } from './types';
import { MountPoint, Part, TemplateInterface } from './types';

type Hole = AttributeHole | EventHole | ChildHole;

enum HoleType {
  ATTRIBUTE = 'ATTRIBUTE',
  EVENT = 'EVENT',
  CHILD = 'CHILD',
}

interface AttributeHole {
  type: HoleType.ATTRIBUTE;
  path: number[];
  index: number;
  name: string;
}

interface EventHole {
  type: HoleType.EVENT;
  path: number[];
  index: number;
  name: string;
}

interface ChildHole {
  type: HoleType.CHILD;
  path: number[];
  index: number;
}

export class Template implements TemplateInterface {
  static parse(strings: TemplateStringsArray, marker: string): Template {
    const html = strings.join(marker).trim();
    const template = document.createElement('template');
    template.innerHTML = html;
    const holes: Hole[] = [];
    parseChildren(template.content, marker, holes, []);
    return new Template(template, holes);
  }

  private _templateElement: HTMLTemplateElement;

  private _holes: Hole[];

  constructor(templateElement: HTMLTemplateElement, holes: Hole[]) {
    this._templateElement = templateElement;
    this._holes = holes;
  }

  mount(values: unknown[], context: Context): MountPoint {
    const node = this._templateElement.content.cloneNode(true);
    const parts = new Array(this._holes.length);
    const cleanups = new Array(this._holes.length);

    for (let i = 0, l = this._holes.length; i < l; i++) {
      const hole = this._holes[i]!;

      let child = node;

      for (let j = 0, m = hole.path.length; j < m; j++) {
        child = child.childNodes[hole.path[j]!]!;
      }

      child = child.childNodes[hole.index]!;

      let part;

      if (hole.type === HoleType.ATTRIBUTE) {
        part = new AttributePart(child as Element, hole.name);
      } else if (hole.type === HoleType.EVENT) {
        part = new EventPart(child as Element, hole.name);
      } else {
        part = new ChildPart(child as ChildNode);
      }

      cleanups[i] = mountPart(part, values[i], context);
      parts[i] = part;
    }

    return { node, parts, cleanups };
  }

  patch(
    parts: Part[],
    oldValues: unknown[],
    newValues: unknown[],
    cleanups: (Cleanup | void)[],
    context: Context,
  ): void {
    for (let i = 0, l = this._holes.length; i < l; i++) {
      cleanups[i] = updatePart(
        parts[i]!,
        oldValues[i],
        newValues[i],
        cleanups[i],
        context,
      );
    }
  }
}

function parseAttribtues(
  element: Element,
  marker: string,
  holes: Hole[],
  path: number[],
  index: number,
): void {
  // Persist element attributes since ones may be removed.
  const attributes = [...element.attributes];
  for (let i = 0, l = attributes.length; i < l; i++) {
    const attribute = attributes[i]!;

    if (attribute.value !== marker) {
      continue;
    }

    const name = attribute.name;

    if (
      name.length > 2 &&
      (name[0] === 'o' || name[0] === 'O') &&
      (name[1] === 'n' || name[1] === 'N')
    ) {
      holes.push({
        type: HoleType.EVENT,
        path,
        index,
        name: name.slice(2),
      });
    } else {
      holes.push({
        type: HoleType.ATTRIBUTE,
        path,
        index,
        name,
      });
    }

    element.removeAttribute(name);
  }
}

function parseChildren(
  node: Node,
  marker: string,
  holes: Hole[],
  path: number[],
): void {
  const { childNodes } = node;

  for (let i = 0, l = childNodes.length; i < l; i++) {
    const child = childNodes[i]!;
    switch (child.nodeType) {
      case Node.ELEMENT_NODE:
        parseAttribtues(child as Element, marker, holes, path, i);
        if (child.childNodes.length > 0) {
          parseChildren(child, marker, holes, [...path, i]);
        }
        break;
      case Node.TEXT_NODE: {
        const components = child.textContent!.split(marker);
        if (components.length <= 1) {
          continue;
        }

        const componentEnd = components.length - 1;
        for (let j = 0; j < componentEnd; j++) {
          const component = components[j]!;
          if (component !== '') {
            const text = document.createTextNode(component);
            node.insertBefore(text, child);
            i++;
            l++;
          }

          holes.push({
            type: HoleType.CHILD,
            path,
            index: i,
          });

          node.insertBefore(document.createComment(''), child);
          i++;
          l++;
        }

        const endComponent = components[componentEnd]!;

        if (endComponent !== '') {
          child.textContent = endComponent;
        } else {
          child.remove();
          i--;
          l--;
        }
        break;
      }
    }
  }
}
