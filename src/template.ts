import { Part, mountPart, updatePart } from './part.js';
import { AttributePart } from './parts.js';
import { ChildPart } from './parts/child.js';
import { EventPart } from './parts/event.js';
import { PropertyPart } from './parts/property.js';
import { SpreadPart } from './parts/spread.js';
import type { MountPoint, TemplateInterface } from './templateInterface.js';
import type { Updater } from './updater.js';

type Hole = AttributeHole | ChildHole | EventHole | PropertyHole | SpreadHole;

interface AttributeHole {
  type: 'attribute';
  path: number[];
  index: number;
  name: string;
}

interface ChildHole {
  type: 'child';
  path: number[];
  index: number;
}

interface EventHole {
  type: 'event';
  path: number[];
  index: number;
  name: string;
}

interface PropertyHole {
  type: 'property';
  path: number[];
  index: number;
  name: string;
}

interface SpreadHole {
  type: 'spread';
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

  mount(values: unknown[], updater: Updater): MountPoint {
    const root = this._templateElement.content.cloneNode(true);
    const parts = new Array(this._holes.length);

    for (let i = 0, l = this._holes.length; i < l; i++) {
      const hole = this._holes[i]!;

      let child = root;

      for (let j = 0, m = hole.path.length; j < m; j++) {
        child = child.childNodes[hole.path[j]!]!;
      }

      child = child.childNodes[hole.index]!;

      let part;

      switch (hole.type) {
        case 'attribute':
          part = new AttributePart(child as Element, hole.name);
          break;
        case 'event':
          part = new EventPart(child as Element, hole.name);
          break;
        case 'child':
          part = new ChildPart(child as ChildNode);
          break;
        case 'property':
          part = new PropertyPart(child as Element, hole.name);
          break;
        case 'spread':
          part = new SpreadPart(child as Element);
          break;
      }

      mountPart(part, values[i], updater);

      parts[i] = part;
    }

    return { children: Array.from(root.childNodes), parts };
  }

  patch(
    parts: Part[],
    oldValues: unknown[],
    newValues: unknown[],
    updater: Updater,
  ): void {
    for (let i = 0, l = this._holes.length; i < l; i++) {
      updatePart(parts[i]!, oldValues[i], newValues[i], updater);
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
    const name = attribute.name;
    const value = attribute.value;

    if (name === marker && value === '') {
      holes.push({
        type: 'spread',
        path,
        index,
      });
    } else if (value === marker) {
      if (name.length > 1 && name[0] === '@') {
        holes.push({
          type: 'event',
          path,
          index,
          name: name.slice(1),
        });
      } else if (name.length > 1 && name[0] === '.') {
        holes.push({
          type: 'property',
          path,
          index,
          name: name.slice(1),
        });
      } else {
        holes.push({
          type: 'attribute',
          path,
          index,
          name,
        });
      }
    } else {
      continue;
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
            type: 'child',
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
