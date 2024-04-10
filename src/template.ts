import { Binding, createBinding, updateBinding } from './binding.js';
import { Part, PartType, Template, TemplateRoot, Updater } from './types.js';

export type Hole =
  | AttributeHole
  | ChildNodeHole
  | ElementHole
  | EventHole
  | NodeHole
  | PropertyHole;

export interface AttributeHole {
  type: PartType.ATTRIBUTE;
  index: number;
  name: string;
}

export interface ChildNodeHole {
  type: PartType.CHILD_NODE;
  index: number;
}

export interface ElementHole {
  type: PartType.ELEMENT;
  index: number;
}

export interface EventHole {
  type: PartType.EVENT;
  index: number;
  name: string;
}

export interface NodeHole {
  type: PartType.NODE;
  index: number;
}

export interface PropertyHole {
  type: PartType.PROPERTY;
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

export class TaggedTemplate implements Template {
  static parseHTML(
    tokens: ReadonlyArray<string>,
    marker: string,
  ): TaggedTemplate {
    // biome-ignore lint: use DEBUG label
    DEBUG: {
      ensureValidMarker(marker);
    }
    const template = document.createElement('template');
    template.innerHTML = tokens.join(marker).trim();
    const holes = parseChildren(template.content, marker);
    return new TaggedTemplate(template, holes);
  }

  static parseSVG(
    tokens: ReadonlyArray<string>,
    marker: string,
  ): TaggedTemplate {
    // biome-ignore lint: use DEBUG label
    DEBUG: {
      ensureValidMarker(marker);
    }
    const template = document.createElement('template');
    template.innerHTML = '<svg>' + tokens.join(marker).trim() + '</svg>';
    template.content.replaceChildren(
      ...template.content.firstChild!.childNodes,
    );
    const holes = parseChildren(template.content, marker);
    return new TaggedTemplate(template, holes);
  }

  private readonly _element: HTMLTemplateElement;

  private readonly _holes: Hole[];

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

  hydrate(values: unknown[], updater: Updater): TaggedTemplateRoot {
    const holes = this._holes;
    const bindings = new Array(holes.length);
    const rootNode = document.importNode(this._element.content, true);

    if (holes.length > 0) {
      const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_ELEMENT |
          NodeFilter.SHOW_TEXT |
          NodeFilter.SHOW_COMMENT,
      );

      let currentHole = holes[0]!;
      let currentNode: Node | null;
      let holeIndex = 0;
      let nodeIndex = 0;

      outer: while ((currentNode = walker.nextNode()) !== null) {
        while (currentHole.index === nodeIndex) {
          let part: Part;

          switch (currentHole.type) {
            case PartType.ATTRIBUTE:
              part = {
                type: PartType.ATTRIBUTE,
                node: currentNode as Element,
                name: currentHole.name,
              };
              break;
            case PartType.CHILD_NODE:
              part = {
                type: PartType.CHILD_NODE,
                node: currentNode as Comment,
              };
              break;
            case PartType.ELEMENT:
              part = {
                type: PartType.ELEMENT,
                node: currentNode as Element,
              };
              break;
            case PartType.EVENT:
              part = {
                type: PartType.EVENT,
                node: currentNode as Element,
                name: currentHole.name,
              };
              break;
            case PartType.NODE:
              part = {
                type: PartType.NODE,
                node: currentNode as ChildNode,
              };
              break;
            case PartType.PROPERTY:
              part = {
                type: PartType.PROPERTY,
                node: currentNode as Element,
                name: currentHole.name,
              };
              break;
          }

          bindings[holeIndex] = createBinding(part, values[holeIndex], updater);
          holeIndex++;

          if (holeIndex >= holes.length) {
            break outer;
          }

          currentHole = holes[holeIndex]!;
        }

        nodeIndex++;
      }
    }

    if (holes.length !== bindings.length) {
      throw new Error(
        'The number of holes and bindings do not match. There may be multiple holes indicating the same attribute.',
      );
    }

    return new TaggedTemplateRoot(bindings, [...rootNode.childNodes]);
  }
}

export class TaggedTemplateRoot implements TemplateRoot {
  private readonly _bindings: Binding<unknown>[];

  private readonly _childNodes: ChildNode[];

  constructor(bindings: Binding<unknown>[], childNodes: ChildNode[]) {
    this._bindings = bindings;
    this._childNodes = childNodes;
  }

  get childNodes(): ChildNode[] {
    return this._childNodes;
  }

  get bindings(): Binding<unknown>[] {
    return this._bindings;
  }

  patch(newValues: unknown[], updater: Updater): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i] = updateBinding(
        this._bindings[i]!,
        newValues[i],
        updater,
      );
    }
  }

  mount(part: Part): void {
    const reference = part.node;

    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      reference.before(this._childNodes[i]!);
    }
  }

  unmount(_part: Part): void {
    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }
  }

  disconnect(): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.disconnect();
    }
  }
}

export function getMarker(
  uuid: ReturnType<typeof crypto.randomUUID> = getUUID(),
): string {
  return '?' + uuid + '?';
}

export function isValidMarker(marker: string): boolean {
  return MARKER_REGEXP.test(marker);
}

function ensureValidMarker(marker: string): void {
  if (!isValidMarker(marker)) {
    throw new Error(`The marker is in an invalid format: ${marker}`);
  }
}

function getUUID(): ReturnType<typeof crypto.randomUUID> {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const s = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const p1 = s.slice(0, 8);
  const p2 = s.slice(8, 12);
  const p3 = s.slice(12, 16);
  const p4 = s.slice(16, 20);
  const p5 = s.slice(20, 32);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
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
        type: PartType.ELEMENT,
        index,
      });
    } else if (value === marker) {
      if (name.length > 1 && name[0] === '@') {
        holes.push({
          type: PartType.EVENT,
          index,
          name: name.slice(1),
        });
      } else if (name.length > 1 && name[0] === '.') {
        holes.push({
          type: PartType.PROPERTY,
          index,
          name: name.slice(1),
        });
      } else {
        holes.push({
          type: PartType.ATTRIBUTE,
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

  let currentNode: ChildNode | null;
  let index = 0;

  while ((currentNode = walker.nextNode() as ChildNode | null) !== null) {
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
        if (
          trimTrailingSlash((currentNode as Comment).data).trim() === marker
        ) {
          (currentNode as Comment).data = '';
          holes.push({
            type: PartType.CHILD_NODE,
            index,
          });
        }
        // biome-ignore lint: use DEBUG label
        DEBUG: {
          if ((currentNode as Comment).data.includes(marker)) {
            throw new Error(
              `Expressions inside a comment must make up the entire comment value: <!--${
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

          for (let i = 0; i < tailIndex; i++) {
            const component = components[i]!;

            if (component !== '') {
              const text = document.createTextNode(component);
              currentNode.before(text);
              index++;
            }

            currentNode.before(document.createTextNode(''));

            holes.push({
              type: PartType.NODE,
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

function trimTrailingSlash(s: string): string {
  return s.at(-1) === '/' ? s.slice(0, -1) : s;
}
