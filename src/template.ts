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
  static parseHTML(
    strings: TemplateStringsArray,
    markerString: string,
  ): Template {
    const content = strings.join(markerString).trim();
    const template = document.createElement('template');
    template.innerHTML = content;
    const walker = document.createTreeWalker(
      template.content,
      NodeFilter.SHOW_ALL,
    );
    const holes = parseTemplate(walker, markerString);
    return new Template(template, holes);
  }

  static parseSVG(
    strings: TemplateStringsArray,
    markerString: string,
  ): Template {
    const content = strings.join(markerString).trim();
    const template = document.createElement('template');
    template.innerHTML = `<svg>${content}</svg>`;
    const svg = template.content.firstChild!;
    svg.replaceWith(...svg.childNodes);
    const walker = document.createTreeWalker(
      template.content,
      NodeFilter.SHOW_ALL,
    );
    const holes = parseTemplate(walker, markerString);
    return new Template(template, holes);
  }

  private _template: HTMLTemplateElement;

  private _holes: Hole[];

  constructor(template: HTMLTemplateElement, holes: Hole[]) {
    this._template = template;
    this._holes = holes;
  }

  mount(values: unknown[], updater: Updater): MountPoint {
    const root = document.importNode(this._template.content, true);
    const parts = new Array(this._holes.length);

    for (let i = 0, l = this._holes.length; i < l; i++) {
      const hole = this._holes[i]!;

      let child: Node = root;

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
  markerString: string,
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

    if (name === markerString && value === '') {
      holes.push({
        type: 'spread',
        path: path.slice(),
        index,
      });
    } else if (value === markerString) {
      if (name.length > 1 && name[0] === '@') {
        holes.push({
          type: 'event',
          path: path.slice(),
          index,
          name: name.slice(1),
        });
      } else if (name.length > 1 && name[0] === '.') {
        holes.push({
          type: 'property',
          path: path.slice(),
          index,
          name: name.slice(1),
        });
      } else {
        holes.push({
          type: 'attribute',
          path: path.slice(),
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

function parseTemplate(walker: TreeWalker, markerString: string): Hole[] {
  const holes: Hole[] = [];
  const path: number[] = [];

  let current = walker.firstChild();
  let index = 0;

  while (current !== null) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      parseAttribtues(current as Element, markerString, holes, path, index);
    } else if (current.nodeType === Node.TEXT_NODE) {
      const components = current.textContent!.split(markerString);
      if (components.length > 1) {
        const tailIndex = components.length - 1;
        for (let i = 0; i < tailIndex; i++) {
          const component = components[i]!;
          if (component !== '') {
            const text = document.createTextNode(component);
            current.parentNode!.insertBefore(text, current);
            index++;
          }

          current.parentNode!.insertBefore(document.createComment(''), current);

          holes.push({
            type: 'child',
            path: path.slice(),
            index,
          });
          index++;
        }

        const tailComponent = components[tailIndex]!;
        if (tailComponent !== '') {
          current.textContent = tailComponent;
        } else {
          walker.currentNode = current.previousSibling!;
          (current as Text).remove();
          index--;
        }
      }
    }

    if ((current = walker.firstChild()) !== null) {
      path.push(index);
      index = 0;
      continue;
    }

    if ((current = walker.nextSibling()) !== null) {
      index++;
      continue;
    }

    while (walker.parentNode() !== null) {
      index = path.pop()!;
      if ((current = walker.nextSibling()) !== null) {
        index++;
        break;
      }
    }
  }

  return holes;
}
