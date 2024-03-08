import { Binding, createBinding, updateBinding } from './binding.js';
import type { Part, Template, TemplateRoot, Updater } from './types.js';

export type Hole =
  | AttributeHole
  | ChildNodeHole
  | ElementHole
  | EventHole
  | PropertyHole;

export interface AttributeHole {
  type: 'attribute';
  index: number;
  name: string;
}

export interface ChildNodeHole {
  type: 'childNode';
  index: number;
}

export interface ElementHole {
  type: 'element';
  index: number;
}

export interface EventHole {
  type: 'event';
  index: number;
  name: string;
}

export interface PropertyHole {
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

export class TaggedTemplate implements Template {
  static parseHTML(
    tokens: ReadonlyArray<string>,
    marker: string,
  ): TaggedTemplate {
    // biome-ignore lint: use DEBUG label
    DEBUG: {
      if (!MARKER_REGEXP.test(marker)) {
        throw new Error(`The marker is in an invalid format: ${marker}`);
      }
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
      if (!MARKER_REGEXP.test(marker)) {
        throw new Error(`The marker is in an invalid format: ${marker}`);
      }
    }
    const template = document.createElement('template');
    template.innerHTML = `<svg>${tokens.join(marker).trim()}</svg>`;
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
            case 'attribute':
              part = {
                type: 'attribute',
                node: currentNode as Element,
                name: currentHole.name,
              };
              break;
            case 'childNode':
              part = {
                type: 'childNode',
                node: currentNode as Comment,
              };
              break;
            case 'element':
              part = {
                type: 'element',
                node: currentNode as Element,
              };
              break;
            case 'event':
              part = {
                type: 'event',
                node: currentNode as Element,
                name: currentHole.name,
              };
              break;
            case 'property':
              part = {
                type: 'property',
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

          for (let i = 0; i < tailIndex; i++) {
            const component = components[i]!;

            if (component !== '') {
              const text = document.createTextNode(component);
              currentNode.before(text);
              index++;
            }

            currentNode.before(document.createComment(''));

            holes.push({
              type: 'childNode',
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
