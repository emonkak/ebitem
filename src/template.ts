import { Part, mountPart, updatePart } from './part.js';
import { AttributePart } from './part/attribute.js';
import { ChildPart } from './part/child.js';
import { ElementPart } from './part/element.js';
import { EventPart } from './part/event.js';
import { PropertyPart } from './part/property.js';
import type { Updater } from './updater.js';

export type Hole =
  | AttributeHole
  | ChildHole
  | ElementHole
  | EventHole
  | PropertyHole;

export interface TemplateInterface {
  mount(values: unknown[], updater: Updater): MountPoint;
  patch(
    parts: Part[],
    oldValues: unknown[],
    newValues: unknown[],
    updater: Updater,
  ): void;
}

export interface MountPoint {
  children: ChildNode[];
  parts: Part[];
}

interface AttributeHole {
  type: 'attribute';
  index: number;
  name: string;
}

interface ChildHole {
  type: 'child';
  index: number;
}

interface ElementHole {
  type: 'element';
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

// Marker Requirements:
// - A marker starts with "?" to detect when it is used as a tag name. In that
//   case, the tag is treated as a comment.
//   https://html.spec.whatwg.org/multipage/parsing.html#parse-error-unexpected-question-mark-instead-of-tag-name
// - A marker is lowercase to match attribute names.
const MARKER_REGEXP =
  /^\?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\?$/;

export class Template implements TemplateInterface {
  static parseHTML(strings: ReadonlyArray<string>, marker: string): Template {
    // biome-ignore lint: use DEBUG label
    DEBUG: {
      if (!MARKER_REGEXP.test(marker)) {
        throw new Error(`The marker is in an invalid format: ${marker}`);
      }
    }
    const template = document.createElement('template');
    template.innerHTML = strings.join(marker).trim();
    const holes = parseChildren(template.content, marker);
    return new Template(template, holes);
  }

  static parseSVG(strings: ReadonlyArray<string>, marker: string): Template {
    // biome-ignore lint: use DEBUG label
    DEBUG: {
      if (!MARKER_REGEXP.test(marker)) {
        throw new Error(`The marker is in an invalid format: ${marker}`);
      }
    }
    const template = document.createElement('template');
    template.innerHTML = `<svg>${strings.join(marker).trim()}</svg>`;
    template.content.replaceChildren(
      ...template.content.firstChild!.childNodes,
    );
    const holes = parseChildren(template.content, marker);
    return new Template(template, holes);
  }

  private _element: HTMLTemplateElement;

  private _holes: Hole[];

  constructor(element: HTMLTemplateElement, holes: Hole[]) {
    this._element = element;
    this._holes = holes;
  }

  get element(): HTMLTemplateElement {
    return this._element;
  }

  get holes(): Hole[] {
    return this._holes;
  }

  mount(values: unknown[], updater: Updater): MountPoint {
    const numHoles = this._holes.length;
    const parts = new Array(numHoles);
    const rootNode = document.importNode(this._element.content, true);

    if (numHoles > 0) {
      const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_ELEMENT |
          NodeFilter.SHOW_TEXT |
          NodeFilter.SHOW_COMMENT,
      );

      let currentHole = this._holes[0]!;
      let currentNode: Node | null;
      let holeIndex = 0;
      let nodeIndex = 0;

      outer: while ((currentNode = walker.nextNode()) !== null) {
        while (currentHole.index === nodeIndex) {
          let part: Part;

          switch (currentHole.type) {
            case 'attribute':
              part = new AttributePart(
                currentNode as Element,
                currentHole.name,
              );
              break;
            case 'child':
              part = new ChildPart(currentNode as Comment);
              break;
            case 'element':
              part = new ElementPart(currentNode as Element);
              break;
            case 'event':
              part = new EventPart(currentNode as Element, currentHole.name);
              break;
            case 'property':
              part = new PropertyPart(currentNode as Element, currentHole.name);
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
  marker: string,
  holes: Hole[],
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
        type: 'element',
        index,
      });
    } else if (value === marker) {
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
      // biome-ignore lint: use DEBUG label
      DEBUG: {
        if (name.includes(marker)) {
          throw new Error(
            `Expressions are not allowed as an attribute name: ${
              (element.cloneNode() as Element).outerHTML
            }`,
          );
        }

        if (value.includes(marker)) {
          throw new Error(
            `Expressions inside an attribute must make up the entire attribute value: ${
              (element.cloneNode() as Element).outerHTML
            }`,
          );
        }
      }

      continue;
    }

    element.removeAttribute(name);
  }
}

function parseChildren(rootNode: Node, marker: string): Hole[] {
  const walker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT,
  );
  const holes: Hole[] = [];

  let currentNode: Node | null;
  let index = 0;

  while ((currentNode = walker.nextNode()) !== null) {
    switch (currentNode.nodeType) {
      case Node.ELEMENT_NODE: {
        // biome-ignore lint: use DEBUG label
        DEBUG: {
          if ((currentNode as Element).tagName.includes(marker.toUpperCase())) {
            throw new Error(
              `Expressions are not allowed as a tag name: ${
                (currentNode.cloneNode() as Element).outerHTML
              }`,
            );
          }
        }
        parseAttribtues(currentNode as Element, marker, holes, index);
        break;
      }
      case Node.COMMENT_NODE: {
        // biome-ignore lint: use DEBUG label
        DEBUG: {
          if ((currentNode as Comment).data.includes(marker)) {
            throw new Error(
              `Expressions are not allowed inside a comment: <!--${
                (currentNode as Comment).data
              }-->`,
            );
          }
        }
        break;
      }
      case Node.TEXT_NODE: {
        const components = (currentNode as Text).data.split(marker);

        if (components.length > 1) {
          const tailIndex = components.length - 1;
          const parent = currentNode.parentNode!;

          for (let i = 0; i < tailIndex; i++) {
            const component = components[i]!;

            if (component !== '') {
              const text = document.createTextNode(component);
              parent.insertBefore(text, currentNode);
              index++;
            }

            parent.insertBefore(document.createComment(''), currentNode);

            holes.push({
              type: 'child',
              index,
            });
            index++;
          }

          const tailComponent = components[tailIndex]!;

          if (tailComponent !== '') {
            // Reuse the current node.
            (currentNode as Text).data = tailComponent;
          } else {
            walker.currentNode = currentNode.previousSibling!;
            (currentNode as Text).remove();
            index--;
          }
        }

        break;
      }
    }
    index++;
  }

  return holes;
}
