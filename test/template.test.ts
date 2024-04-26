import { describe, expect, it } from 'vitest';

import {
  AttributeBinding,
  EventBinding,
  NodeBinding,
  PropertyBinding,
  SpreadBinding,
} from '../src/binding.js';
import {
  Template,
  TemplateRoot,
  getMarker,
  isValidMarker,
} from '../src/template.js';
import { Part, PartType, directiveTag } from '../src/types.js';
import { LocalUpdater } from '../src/updater/local.js';
import { MockBinding, MockDirective } from './mocks.js';

const MARKER = getMarker();

describe('Template', () => {
  describe('.parseHTML()', () => {
    it('should parse holes inside attributes', () => {
      const template = html`
        <input type="checkbox" id=${0} .value=${1} @change=${2}>
      `;
      expect(template.holes).toEqual([
        { type: PartType.ATTRIBUTE, name: 'id', index: 0 },
        { type: PartType.PROPERTY, name: 'value', index: 0 },
        { type: PartType.EVENT, name: 'change', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<input type="checkbox">');
    });

    it('should parse holes inside double-quoted attributes', () => {
      const template = html`
        <input type="checkbox" id="${0}" .value="${1}" @change="${2}">
      `;
      expect(template.holes).toEqual([
        { type: PartType.ATTRIBUTE, name: 'id', index: 0 },
        { type: PartType.PROPERTY, name: 'value', index: 0 },
        { type: PartType.EVENT, name: 'change', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<input type="checkbox">');
    });

    it('should parse holes inside single-quoted attributes', () => {
      const template = html`
        <input type="checkbox" id='${0}' .value='${1}' @change='${2}'>
      `;
      expect(template.holes).toEqual([
        { type: PartType.ATTRIBUTE, name: 'id', index: 0 },
        { type: PartType.PROPERTY, name: 'value', index: 0 },
        { type: PartType.EVENT, name: 'change', index: 0 },
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
        { type: PartType.CHILD_NODE, index: 0 },
        { type: PartType.CHILD_NODE, index: 2 },
        { type: PartType.CHILD_NODE, index: 4 },
        { type: PartType.CHILD_NODE, index: 6 },
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
        { type: PartType.ELEMENT, index: 0 },
        { type: PartType.ELEMENT, index: 2 },
        { type: PartType.ELEMENT, index: 4 },
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
        { type: PartType.NODE, index: 3 },
        { type: PartType.NODE, index: 6 },
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
        { type: PartType.NODE, index: 2 },
        { type: PartType.NODE, index: 4 },
        { type: PartType.NODE, index: 8 },
        { type: PartType.NODE, index: 10 },
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
        { type: PartType.CHILD_NODE, index: 0 },
        { type: PartType.CHILD_NODE, index: 2 },
        { type: PartType.CHILD_NODE, index: 4 },
        { type: PartType.CHILD_NODE, index: 6 },
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
        { type: PartType.NODE, index: 1 },
        { type: PartType.NODE, index: 3 },
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
        Template.parseHTML([], 'INVALID_MARKER');
      }).toThrow('The marker is in an invalid format:');
      expect(() => {
        Template.parseHTML([], MARKER.toUpperCase());
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
        { type: PartType.ATTRIBUTE, name: 'cx', index: 0 },
        { type: PartType.ATTRIBUTE, name: 'cy', index: 0 },
        { type: PartType.ATTRIBUTE, name: 'r', index: 0 },
      ]);
      expect(template.element.innerHTML).toBe('<circle fill="black"></circle>');
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
    });

    it('should throw an error when it is passed a marker in an invalid format', () => {
      expect(() => {
        Template.parseSVG([], 'INVALID_MARKER');
      }).toThrow('The marker is in an invalid format:');
      expect(() => {
        Template.parseSVG([], MARKER.toUpperCase());
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
      const updater = new LocalUpdater();
      const root = template.hydrate(values, updater);

      expect(root).toBeInstanceOf(TemplateRoot);
      expect(root.bindings).toHaveLength(values.length);
      expect(root.childNodes).toHaveLength(1);

      expect(root.bindings.map((binding) => binding.value)).toEqual(values);

      expect(root.bindings[0]).toBeInstanceOf(AttributeBinding);
      expect(root.bindings[0]?.part).toMatchObject({
        type: PartType.ATTRIBUTE,
        name: 'class',
      });
      expect(root.bindings[1]).toBeInstanceOf(NodeBinding);
      expect(root.bindings[1]?.part).toMatchObject({
        type: PartType.CHILD_NODE,
      });
      expect(root.bindings[2]).toBeInstanceOf(PropertyBinding);
      expect(root.bindings[2]?.part).toMatchObject({
        type: PartType.PROPERTY,
        name: 'value',
      });
      expect(root.bindings[3]).toBeInstanceOf(EventBinding);
      expect(root.bindings[3]?.part).toMatchObject({
        type: PartType.EVENT,
        name: 'onchange',
      });
      expect(root.bindings[4]).toBeInstanceOf(SpreadBinding);
      expect(root.bindings[4]?.part).toMatchObject({
        type: PartType.ELEMENT,
      });
      expect(root.bindings[5]).toBeInstanceOf(MockBinding);
      expect(root.bindings[5]?.part).toMatchObject({
        type: PartType.NODE,
      });

      updater.flush();

      expect((root.childNodes[0] as Element)?.outerHTML).toBe(
        `
        <div class="foo">
          <!--bar-->
          <input type="text" class="qux"><span></span>
        </div>`.trim(),
      );
    });

    it('should throw an error if the number of holes and values do not match', () => {
      const template = html`
        <div class=${0} class=${1}></div>
      `;
      const values = ['foo', 'bar'];
      const updater = new LocalUpdater();
      expect(() => {
        template.hydrate(values, updater);
      }).toThrow('There may be multiple holes indicating the same attribute.');
    });
  });
});

describe('TemplateRoot', () => {
  describe('.mount()', () => {
    it('should mount child nodes on the part', () => {
      const template = html`
        <p>Hello, ${0}!</p>
      `;
      const values = ['World'];
      const updater = new LocalUpdater();
      const root = template.hydrate(values, updater);

      updater.flush();

      const container = document.createElement('div');
      const marker = document.createComment('');

      container.appendChild(marker);

      root.mount({
        type: PartType.CHILD_NODE,
        node: marker,
      });

      expect(container.innerHTML, '<p>Hello).toBe(World!</p><!---->');

      root.unmount({
        type: PartType.CHILD_NODE,
        node: marker,
      });

      expect(container.innerHTML).toBe('<!---->');
    });
  });

  describe('.update()', () => {
    it('should update bindings with new values', () => {
      const template = html`
        <p>Count: ${0}</p>
      `;
      const values = [0];
      const updater = new LocalUpdater();
      const root = template.hydrate(values, updater);

      updater.flush();

      expect((root.childNodes[0] as Element)?.outerHTML).toBe(
        '<p>Count: 0</p>',
      );

      root.update([1], updater);

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
      const updater = new LocalUpdater();
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

function html(tokens: TemplateStringsArray, ..._values: unknown[]): Template {
  return Template.parseHTML(tokens, MARKER);
}

function svg(tokens: TemplateStringsArray, ..._values: unknown[]): Template {
  return Template.parseSVG(tokens, MARKER);
}
