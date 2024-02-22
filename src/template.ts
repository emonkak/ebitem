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
  index: number;
  name: string;
}

interface ChildHole {
  type: 'child';
  index: number;
}

interface EventHole {
  type: 'event';
  index: number;
  name: string;
}

interface PropertyHole {
  type: 'property';
  index: number;
  name: string;
}

interface SpreadHole {
  type: 'spread';
  index: number;
}

export class Template implements TemplateInterface {
  static parseHTML(
    strings: TemplateStringsArray,
    markerString: string,
  ): Template {
    const template = document.createElement('template');
    template.innerHTML = strings.join(markerString).trim();
    const holes = parseChildren(template.content, markerString);
    return new Template(template, holes);
  }

  static parseSVG(
    strings: TemplateStringsArray,
    markerString: string,
  ): Template {
    const template = document.createElement('template');
    template.innerHTML = '<svg>' + strings.join(markerString).trim() + '</svg>';
    template.content.replaceChildren(
      ...template.content.firstChild!.childNodes,
    );
    const holes = parseChildren(template.content, markerString);
    return new Template(template, holes);
  }

  private _template: HTMLTemplateElement;

  private _holes: Hole[];

  constructor(template: HTMLTemplateElement, holes: Hole[]) {
    this._template = template;
    this._holes = holes;
  }

  mount(values: unknown[], updater: Updater): MountPoint {
    const numHoles = this._holes.length;
    const parts = new Array(numHoles);
    const rootNode = document.importNode(this._template.content, true);

    if (numHoles > 0) {
      const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_ELEMENT |
          NodeFilter.SHOW_TEXT |
          NodeFilter.SHOW_COMMENT,
      );

      let currentHole = this._holes[0]!;
      let currentNode;
      let holeIndex = 0;
      let nodeIndex = 0;

      outer: while ((currentNode = walker.nextNode()) !== null) {
        while (currentHole.index === nodeIndex) {
          let part;

          switch (currentHole.type) {
            case 'attribute':
              part = new AttributePart(
                currentNode as Element,
                currentHole.name,
              );
              break;
            case 'event':
              part = new EventPart(currentNode as Element, currentHole.name);
              break;
            case 'child':
              part = new ChildPart(currentNode as ChildNode);
              break;
            case 'property':
              part = new PropertyPart(currentNode as Element, currentHole.name);
              break;
            case 'spread':
              part = new SpreadPart(currentNode as Element);
              break;
          }

          mountPart(part, values[holeIndex], updater);

          parts[holeIndex] = part;
          holeIndex++;

          if (holeIndex >= numHoles) {
            break outer;
          }

          currentHole = this._holes[holeIndex]!;
        }

        nodeIndex++;
      }
    }

    return { children: [...rootNode.childNodes], parts };
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
        index,
      });
    } else if (value === markerString) {
      if (name.length > 1 && name[0] === '@') {
        holes.push({
          type: 'event',
          index,
          name: name.slice(1),
        });
      } else if (name.length > 1 && name[0] === '.') {
        holes.push({
          type: 'property',
          index,
          name: name.slice(1),
        });
      } else {
        holes.push({
          type: 'attribute',
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

function parseChildren(rootNode: Node, markerString: string): Hole[] {
  const walker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
  const holes: Hole[] = [];

  let current;
  let index = 0;

  while ((current = walker.nextNode()) !== null) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      parseAttribtues(current as Element, markerString, holes, index);
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
    index++;
  }

  return holes;
}
