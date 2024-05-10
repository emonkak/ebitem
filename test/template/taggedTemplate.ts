import { describe, expect, it } from 'vitest';

import {
  AttributeBinding,
  EventBinding,
  NodeBinding,
  Part,
  PartType,
  PropertyBinding,
  SpreadBinding,
  directiveTag,
} from '../../src/binding.js';
import { Scope } from '../../src/scope.js';
import {
  TaggedTemplate,
  TaggedTemplateRoot,
  getMarker,
  isValidMarker,
} from '../../src/template/taggedTemplate.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBinding, MockDirective } from '../mocks.js';

const MARKER = getMarker();

describe('TaggedTemplate', () => {
  describe('.parseHTML()', () => {
    it('should parse holes inside attributes', () => {
      const template = html`
        <input type="checkbox" id=${0} .value=${1} @change=${2}>
      `;
      expect(template.holes).toEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Property, name: 'value', index: 0 },
        { type: PartType.Event, name: 'change', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<input type="checkbox">');
    });

    it('should parse holes inside double-quoted attributes', () => {
      const template = html`
        <input type="checkbox" id="${0}" .value="${1}" @change="${2}">
      `;
      expect(template.holes).toEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Property, name: 'value', index: 0 },
        { type: PartType.Event, name: 'change', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<input type="checkbox">');
    });

    it('should parse holes inside single-quoted attributes', () => {
      const template = html`
        <input type="checkbox" id='${0}' .value='${1}' @change='${2}'>
      `;
      expect(template.holes).toEqual([
        { type: PartType.Attribute, name: 'id', index: 0 },
        { type: PartType.Property, name: 'value', index: 0 },
        { type: PartType.Event, name: 'change', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<input type="checkbox">');
    });

    it('should parse a hole inside a tag name', () => {
      const template = html`
        <${0}>
        <${1} >
        <${2}/>
        <${3} />
      `;
      expect(template.holes).toEqual([
        { type: PartType.ChildNode, index: 0 },
        { type: PartType.ChildNode, index: 2 },
        { type: PartType.ChildNode, index: 4 },
        { type: PartType.ChildNode, index: 6 },
      ]);
      expect(template.element.innerHTML).toBe(
        `
        <!---->
        <!---->
        <!---->
        <!---->
      `.trim(),
      );
    });

    it('should parse holes inside elements', () => {
      const template = html`
        <div id="foo" ${0}></div>
        <div ${1} id="foo"></div>
        <div id="foo" ${2} class="bar"></div>
      `;
      expect(template.holes).toEqual([
        { type: PartType.Element, index: 0 },
        { type: PartType.Element, index: 2 },
        { type: PartType.Element, index: 4 },
      ]);
      expect(template.element.innerHTML).toBe(
        `
        <div id="foo"></div>
        <div id="foo"></div>
        <div id="foo" class="bar"></div>
      `.trim(),
      );
    });

    it('should parse holes inside descendants', () => {
      const template = html`
        <ul>
          <li>${1}</li>
          <li>${2}</li>
        </ul>
      `;
      expect(template.holes).toEqual([
        { type: PartType.Node, index: 3 },
        { type: PartType.Node, index: 6 },
      ]);
      expect(template.element.innerHTML).toBe(
        `
        <ul>
          <li></li>
          <li></li>
        </ul>
      `.trim(),
      );
    });

    it('should parse multiple holes inside a child', () => {
      const template = html`
        <div>[${0}, ${1}]</div>
        <div>${0}, ${1}</div>
      `;
      expect(template.holes).toEqual([
        { type: PartType.Node, index: 2 },
        { type: PartType.Node, index: 4 },
        { type: PartType.Node, index: 8 },
        { type: PartType.Node, index: 10 },
      ]);
      expect(template.element.innerHTML).toBe(
        `
        <div>[, ]</div>
        <div>, </div>
      `.trim(),
      );
    });

    it('should parse a hole inside a comment as ChildNodeHole', () => {
      const template = html`
        <!--${0}-->
        <!--${1}/-->
        <!-- ${2} -->
        <!-- ${3} /-->
      `;
      expect(template.holes).toEqual([
        { type: PartType.ChildNode, index: 0 },
        { type: PartType.ChildNode, index: 2 },
        { type: PartType.ChildNode, index: 4 },
        { type: PartType.ChildNode, index: 6 },
      ]);
      expect(template.element.innerHTML).toBe(
        `
        <!---->
        <!---->
        <!---->
        <!---->
      `.trim(),
      );
    });

    it('should parse a hole inside a tag with leading spaces as NodeHole', () => {
      const template = html`
        < ${0}>
        < ${0}/>
      `;
      expect(template.holes).toEqual([
        { type: PartType.Node, index: 1 },
        { type: PartType.Node, index: 3 },
      ]);
      expect(template.element.innerHTML).toBe(
        `
        &lt; &gt;
        &lt; /&gt;
      `.trim(),
      );
    });

    it('should throw an error if passed a marker in an invalid format', () => {
      expect(() => {
        TaggedTemplate.parseHTML([], 'INVALID_MARKER');
      }).toThrow('The marker is in an invalid format:');
      expect(() => {
        TaggedTemplate.parseHTML([], MARKER.toUpperCase());
      }).toThrow('The marker is in an invalid format:');
    });

    it('should throw an error when there is a hole as an attribute name', () => {
      expect(() => {
        html`
          <div ${0}="foo"></div>
        `;
      }).toThrow('Expressions are not allowed as an attribute name:');
      expect(() => {
        html`
          <div x-${0}="foo"></div>
        `;
      }).toThrow('Expressions are not allowed as an attribute name:');
      expect(() => {
        html`
          <div ${0}-x="foo"></div>
        `;
      }).toThrow('Expressions are not allowed as an attribute name:');
    });

    it('should throw an error when there is a hole with extra strings inside an attribute value', () => {
      expect(() => {
        html`
          <div class=" ${0}"></div>
        `;
      }).toThrow(
        'Expressions inside an attribute must make up the entire attribute value:',
      );
      expect(() => {
        html`
          <div class="${0} "></div>
        `;
      }).toThrow(
        'Expressions inside an attribute must make up the entire attribute value:',
      );
    });

    it('should throw an error when there is a hole with extra strings inside a tag name', () => {
      expect(() => {
        html`
          <x-${0}>
        `;
      }).toThrow('Expressions are not allowed as a tag name:');
      expect(() => {
        html`
          <${0}-x>
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
      expect(() => {
        html`
          <${0}/ >
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
    });

    it('should throw an error when there is a hole with extra strings inside a comment', () => {
      expect(() => {
        html`
          <!-- x-${0} -->
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
      expect(() => {
        html`
          <!-- ${0}-x -->
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
      expect(() => {
        html`
          <!-- ${0}/ -->
        `;
      }).toThrow(
        'Expressions inside a comment must make up the entire comment value:',
      );
    });
  });

  describe('.parseSVG()', () => {
    it('should parse holes inside attributes', () => {
      const template = svg`
        <circle fill="black" cx=${0} cy=${1} r=${2} />
      `;
      expect(template.holes).toEqual([
        { type: PartType.Attribute, name: 'cx', index: 0 },
        { type: PartType.Attribute, name: 'cy', index: 0 },
        { type: PartType.Attribute, name: 'r', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<circle fill="black"></circle>');
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
    });

    it('should throw an error when it is passed a marker in an invalid format', () => {
      expect(() => {
        TaggedTemplate.parseSVG([], 'INVALID_MARKER');
      }).toThrow('The marker is in an invalid format:');
      expect(() => {
        TaggedTemplate.parseSVG([], MARKER.toUpperCase());
      }).toThrow('The marker is in an invalid format:');
    });
  });

  describe('.hydrate()', () => {
    it('should return a TaggedTemplateRoot', () => {
      const template = html`
        <div class=${0}>
          <!-- ${1} -->
          <input type="text" .value=${2} @onchange=${3} ${4}><span>${5}</span>
        </div>
      `;
      const values = [
        'foo',
        'bar',
        'baz',
        () => {},
        { class: 'qux' },
        new MockDirective(),
      ];
      const updater = new SyncUpdater(new Scope());
      const root = template.hydrate(values, updater);

      expect(root).toBeInstanceOf(TaggedTemplateRoot);
      expect(root.bindings).toHaveLength(values.length);
      expect(root.childNodes).toHaveLength(1);

      expect(root.bindings.map((binding) => binding.value)).toEqual(values);

      expect(root.bindings[0]).toBeInstanceOf(AttributeBinding);
      expect(root.bindings[0]?.part).toMatchObject({
        type: PartType.Attribute,
        name: 'class',
      });
      expect(root.bindings[1]).toBeInstanceOf(NodeBinding);
      expect(root.bindings[1]?.part).toMatchObject({
        type: PartType.ChildNode,
      });
      expect(root.bindings[2]).toBeInstanceOf(PropertyBinding);
      expect(root.bindings[2]?.part).toMatchObject({
        type: PartType.Property,
        name: 'value',
      });
      expect(root.bindings[3]).toBeInstanceOf(EventBinding);
      expect(root.bindings[3]?.part).toMatchObject({
        type: PartType.Event,
        name: 'onchange',
      });
      expect(root.bindings[4]).toBeInstanceOf(SpreadBinding);
      expect(root.bindings[4]?.part).toMatchObject({
        type: PartType.Element,
      });
      expect(root.bindings[5]).toBeInstanceOf(MockBinding);
      expect(root.bindings[5]?.part).toMatchObject({
        type: PartType.Node,
      });

      updater.flush();

      expect((root.childNodes[0] as Element)?.outerHTML).toBe(
        `
        <div class="foo">
          <!--bar-->
          <input type="text" class="qux"><span></span>
        </div>`.trim(),
      );
      expect(root.childNodes[0]).toBe(root.startNode);
      expect(root.childNodes[0]).toBe(root.endNode);
    });

    it('should throw an error if the number of holes and values do not match', () => {
      const template = html`
        <div class=${0} class=${1}></div>
      `;
      const values = ['foo', 'bar'];
      const updater = new SyncUpdater(new Scope());
      expect(() => {
        template.hydrate(values, updater);
      }).toThrow('There may be multiple holes indicating the same attribute.');
    });
  });
});

describe('TaggedTemplateRoot', () => {
  describe('.mount()', () => {
    it('should mount child nodes on the part', () => {
      const template = html`
        <p>Hello, ${0}!</p>
      `;
      const values = ['World'];
      const updater = new SyncUpdater(new Scope());
      const root = template.hydrate(values, updater);

      updater.flush();

      const container = document.createElement('div');
      const marker = document.createComment('');

      container.appendChild(marker);

      root.mount({
        type: PartType.ChildNode,
        node: marker,
      });

      expect(container.innerHTML, '<p>Hello).toBe(World!</p><!---->');

      root.unmount({
        type: PartType.ChildNode,
        node: marker,
      });

      expect(container.innerHTML).toBe('<!---->');
    });
  });

  describe('.bindValues()', () => {
    it('should update bindings with new values', () => {
      const template = html`
        <p>Count: ${0}</p>
      `;
      const values = [0];
      const updater = new SyncUpdater(new Scope());
      const root = template.hydrate(values, updater);

      updater.flush();

      expect((root.childNodes[0] as Element)?.outerHTML).toBe(
        '<p>Count: 0</p>',
      );

      root.bindValues([1], updater);

      updater.flush();

      expect((root.childNodes[0] as Element)?.outerHTML).toBe(
        '<p>Count: 1</p>',
      );
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect bindings', () => {
      let disconnects = 0;
      const template = html`
        <p>Count: ${0}</p>
      `;
      const values = [
        Object.assign(new MockDirective(), {
          [directiveTag](this: MockDirective, part: Part) {
            return Object.assign(new MockBinding(this, part), {
              disconnect() {
                disconnects++;
              },
            });
          },
        }),
      ];
      const updater = new SyncUpdater(new Scope());
      const root = template.hydrate(values, updater);

      expect(disconnects).toBe(0);

      root.disconnect();

      expect(disconnects).toBe(1);
    });
  });
});

describe('getMarker()', () => {
  it('returns a valid marker string', () => {
    expect(isValidMarker(getMarker())).toBe(true);

    // force randomUUID() polyfill.
    const originalRandomUUID = crypto.randomUUID;
    try {
      (crypto as any).randomUUID = null;
      expect(isValidMarker(getMarker())).toBe(true);
    } finally {
      crypto.randomUUID = originalRandomUUID;
    }
  });
});

function html(
  tokens: TemplateStringsArray,
  ..._values: unknown[]
): TaggedTemplate {
  return TaggedTemplate.parseHTML(tokens, MARKER);
}

function svg(
  tokens: TemplateStringsArray,
  ..._values: unknown[]
): TaggedTemplate {
  return TaggedTemplate.parseSVG(tokens, MARKER);
}
