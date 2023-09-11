const HOLE = getUUID();
const HOLE_COMMENT = '<!--' + HOLE + '-->';

const SPACES = ` \\f\\n\\r\\t`;
const TAG_START = `<[A-Za-z][A-Za-z0-9:._-]*`;
const TAG_END = `[${SPACES}]*/?>`;
const ATTRIBUTE_NAME = `[${SPACES}]+[^${SPACES}"'>/=]+`;
const ATTRIBUTE_VALUE =
    `\\s*=\\s*(?:'[^']*'|"[^"]*"|<[^>]*>|[^${SPACES}"'=><\`])`;

const TAG_PATTERN = new RegExp(
    `(${TAG_START})(${ATTRIBUTE_NAME}(?:${ATTRIBUTE_VALUE})?)+(${TAG_END})`,
    'g'
);
const ATTRIBUTE_HOLE_PATTERN = new RegExp(
    `(${ATTRIBUTE_NAME}\\s*=\\s*)([\'"]?)${HOLE_COMMENT}\\2`,
    'g'
);

class Context {
    constructor(scheduler) {
        this._currentBlock = undefined;
        this._pendingEffects = [];
        this._pendingBlocks = [];
        this._hookIndex = 0;
        this._templateCaches = new WeakMap();
    }

    html(strings, ...values) {
        let template = this._templateCaches.get(strings);

        if (!template) {
            template = Template.create(strings);
            this._templateCaches.set(strings, template);
        }

        return {
            template,
            values,
        };
    }

    useState(initialState) {
        const { hooks } = this._currentBlock;
        let hook = hooks[this._hookIndex];

        if (!hook) {
            hooks[this._hookIndex] = hook = {
                state: initialState,
                block: this._currentBlock,
                context: this,
                setState(newState) {
                    if (this.state !== newState) {
                        this.state = newState;
                        this.block.status = BlockStatus.DIRTY;
                        this.context.requestUpdate(this.block);
                    }
                },
            };
        }

        this._hookIndex++;

        return [hook.state, hook.setState.bind(hook)];
    }

    useEffect(perform, deps) {
        const { hooks } = this._currentBlock;
        let hook = hooks[this._hookIndex];
        let shouldPerform;

        if (hook) {
            hook.perform = perform;
            hook.deps = deps;
            shouldPerform = !shallowEqual(hook.deps, deps);
        } else {
            hooks[this._hookIndex] = hook = {
                perform,
                deps,
                finalize: null,
                commit() {
                    if (this.finalize) {
                        this.finalize(this);
                    }
                    this.finalize = this.perform(this);
                },
            };
            shouldPerform = true;
        }

        if (shouldPerform) {
            this.enqueueEffect(hook);
        }

        this._hookIndex++;
    }

    requestUpdate(block) {
        if (this._currentBlock) {
            if (this._currentBlock !== block) {
                this._pendingBlocks.push(block);
            }
        } else {
            this._currentBlock = block;
            this._startRendering();
        }
    }

    enqueueEffect(effect) {
        this._pendingEffects.push(effect);
    }

    _startRendering() {
        queueMicrotask(this._rendering_loop);
    }

    _rendering_loop = () => {
        while (this._currentBlock != null) {
            this._hookIndex = 0;
            this._currentBlock.update(this);
            this._currentBlock = this._pendingBlocks.shift();
        }

        let effect;

        while (effect = this._pendingEffects.shift()) {
            effect.commit();
        }
    }
}

class Template {
    static create(strings) {
        const html = formatHtml(strings);
        const template = parseHtml(html);
        const holes = [];
        parseChildren(template.content, holes, []);
        return new Template(template, holes);
    }

    constructor(template, holes) {
        this._template = template;
        this._holes = holes;
    }

    mount(values, context) {
        const element = this._template.content.cloneNode(true);
        const parts = new Array(this._holes.length);

        for (let i = 0, l = this._holes.length; i < l; i++) {
            const hole = this._holes[i];

            let child = element;

            for (let j = 0, m = hole.path.length; j < m; j++) {
                child = child.childNodes[hole.path[j]];
            }

            child = child.childNodes[hole.index];

            const value = values[i];

            let part;

            if (hole.type === 'attribute') {
                if (hole.attribute.startsWith('on')) {
                    part = new EventPart(child, hole.attribute.slice(2), value);
                } else  {
                    part = new AttributePart(child, hole.attribute, value);
                }
            } else {  //  hole.type === 'child'
                part = new ChildPart(child, value);
            }

            if (value instanceof Directive) {
                value.perform(part, context);
            } else {
                part.setValue(value);
                context.enqueueEffect(part);
            }

            parts[i] = part;
        }

        return { element, parts };
    }

    patch(parts, oldValues, newValues, context) {
        for (let i = 0, l = this._holes.length; i < l; i++) {
            const oldValue = oldValues[i];
            const newValue = newValues[i];

            if (oldValue === newValue) {
                continue;
            }

            const part = parts[i];

            if (newValue instanceof Directive) {
                newValue.perform(part, context);
            } else if (oldValue !== newValue) {
                part.setValue(newValue);
                context.enqueueEffect(part);
            }

            if (oldValue instanceof Directive) {
                if (oldValue.finalize) {
                    oldValue.finalize(part, context);
                }
            }
        }
    }
}

class AttributePart {
    constructor(element, attribute) {
        this.element = element;
        this.attribute = attribute;
        this.commitedValue = undefined;
        this.pendingValue = undefined;
    }

    get value() {
        return this.commitedValue;
    }

    setValue(value) {
        this.pendingValue = value;
    }

    commit() {
        const { element, attribute, pendingValue: value } = this;

        if (value === true) {
            element.setAttribute(attribute, '');
        } else if (value === false || value == null) {
            element.removeAttribute(attribute);
        } else {
            element.setAttribute(attribute, value.toString());
        }
    }
}

class EventPart {
    constructor(element, event) {
        this.element = element;
        this.event = event;
        this.commitedValue = undefined;
        this.pendingValue = undefined;
    }

    get value() {
        return this.commitedValue;
    }

    setValue(value) {
        this.pendingValue = value;
    }

    commit() {
        const {
            element,
            event,
            commitedValue: oldValue,
            pendingValue: newValue
        } = this;

        if (oldValue != null) {
            element.removeEventListener(event, oldValue);
        }

        if (newValue != null) {
            element.addEventListener(event, newValue);
        }

        this.commitedValue = newValue;
    }
}

class ChildPart {
    constructor(node) {
        this.startNode = node;
        this.endNode = node;
        this.commitedValue = undefined;
        this.pendingValue = undefined;
    }

    get value() {
        return this.commitedValue;
    }

    setValue(value) {
        this.pendingValue = value;
    }

    commit() {
        const { startNode, endNode, pendingValue, commitedValue } = this;
        const { parentNode } = startNode;
        const oldValues = toArray(commitedValue);
        const newValues = toArray(pendingValue);

        let i = 0;
        let l = newValues.length;
        let currentNode = startNode;

        for (; i < l && currentNode !== endNode; i++) {
            const oldValue = oldValues[i];
            const newValue = newValues[i];
            if (oldValue === newValue) {
                currentNode = currentNode.nextSibling;
            } else {
                const newNode = insertNode(parentNode, currentNode, newValue);
                if (i === 0) {
                    this.startNode = newNode ?? endNode;
                }
            }
        }

        while (currentNode !== endNode) {
            const { nextSibling } = currentNode;
            parentNode.removeChild(currentNode);
            currentNode = nextSibling;
        }

        for (; i < l; i++) {
            const newNode = insertNode(parentNode, currentNode, newValues[i]);
            if (i === 0) {
                this.startNode = newNode ?? endNode;
            }
        }

        if (l === 0) {
            this.startNode = endNode;
        }

        this.commitedValue = pendingValue;
    }
}

const BlockStatus = {
    CLEAN: 1,
    DIRTY: 2,
    REMOVING: 3,
    INVALID: 4,
};

class Block {
    constructor(render, props) {
        this.render = render;
        this.props = props;
        this.status = BlockStatus.DIRTY;
        this.element = null;
        this.parts = [];
        this.values = [];
        this.hooks = [];
    }

    update(context) {
        if (this.status === BlockStatus.DIRTY) {
            const { template, values } = this.render(this.props, context);

            if (this.element) {
                template.patch(this.parts, this.values, values, context)
            } else {
                const { element, parts } = template.mount(values, context);
                this.element = element;
                this.parts = parts;
            }

            this.values = values;
            this.status = BlockStatus.CLEAN;
        } else if (this.status === BlockStatus.REMOVING) {
            for (let i = 0, l = this.hooks.length; i < l; i++) {
                const hook = this.hooks[i];
                if (hook.finalize) {
                    hook.finalize(context);
                }
            }

            for (let i = 0, l = this.values.length; i < l; i++) {
                const value = this.values[i];
                if (value.finalize) {
                    const part = this.parts[i];
                    value.finalize(part, context);
                }
            }
            this.status = BlockStatus.INVALID;
        }
    }
}

class Directive {
    perform(_part, _context) {
    }
}

class Component extends Directive {
    constructor(render, props) {
        super();
        this.render = render;
        this.props = props;
    }

    perform(part, context) {
        let value = part.value;

        if (value instanceof Block) {
            value = part.value;
            value.render = this.render;
            value.props = this.props;
            value.status = BlockStatus.DIRTY;
        } else {
            value = new Block(this.render, this.props);

            part.setValue(value);

            context.enqueueEffect(part);
        }

        context.requestUpdate(value);
    }

    finalize(part, context) {
        const value = part.value;

        if (value instanceof Block) {
            if (value.status !== BlockStatus.DIRTY) {
                value.status = BlockStatus.REMOVING;
                context.requestUpdate(block);
            }
        }
    }
}

function getUUID() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }
    const s = [...crypto.getRandomValues(new Uint8Array(16))]
        .map((v) => v.toString(16).padStart('0', 2))
        .join('');
    return s.slice(0, 8) + '-' +
        s.slice(8, 12) + '-' +
        s.slice(12, 16) + '-' +
        s.slice(16, 20) + '-' +
        s.slice(20, 32);
}

function formatHtml(strings) {
    return strings.join(HOLE_COMMENT)
        .replace(TAG_PATTERN, replaceTag);
}

function parseHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template;
}

function replaceTag($0, $1, $2, $3) {
  return $1 + $2.replace(ATTRIBUTE_HOLE_PATTERN, replaceHoleInAttributes) + $3;
}

function replaceHoleInAttributes($0, $1, $2) {
    return $1 + '"' + HOLE + '"';
}

function parseChildren(node, holes, path) {
    const { childNodes } = node;

    for (let i = 0, l = childNodes.length; i < l; i++) {
        const child = childNodes[i];
        switch (child.nodeType)  {
        case Node.ELEMENT_NODE:
            parseAttribtues(child, holes, path, i);
            if (child.childNodes.length > 0) {
                parseChildren(child, holes, [...path, i]);
            }
            break;
        case Node.COMMENT_NODE:
            if (child.data === HOLE) {
                holes.push({
                    type: 'child',
                    path,
                    index: i,
                });
            }
            break;
        }
    }
}

function parseAttribtues(node, holes, path, index) {
    const { attributes } = node;
    for (let i = 0, l = attributes.length; i < l; i++) {
        const attribute = attributes[i];
        if (attribute.value === HOLE) {
            holes.push({
                type: 'attribute',
                path,
                index,
                attribute: attribute.name,
            });
            node.removeAttribute(attribute.name);
        }
    }
}

function insertNode(parentNode, currentNode, value) {
    if (value instanceof Block) {
        const firstChild = value.element.firstChild;
        parentNode.insertBefore(value.element, currentNode);
        return firstChild;
    }
    if (value instanceof Node) {
        parentNode.insertBefore(value, currentNode);
        return value;
    }
    if (value == null) {
        const comment = document.createComment('');
        parentNode.insertBefore(text, comment);
        return comment;
    }
    const text = document.createTextNode(value.toString());
    parentNode.insertBefore(text, currentNode);
    return text;
}

function toArray(value) {
    if (value == null) {
        return []
    }
    if (Array.isArray(value)) {
        return value;
    }
    return [value];
}

function shallowEqual(first, second) {
    if (first === second) {
        return true;
    }

    if (
        typeof first !== 'object' ||
        typeof second !== 'object' ||
        first === null ||
        second === null
    ) {
        return false;
    }

    const firstKeys = Object.keys(first);
    const secondKeys = Object.keys(second);

    if (firstKeys.length !== secondKeys.length) {
        return false;
    }

    for (let i = 0, l = firstKeys.length; i < l; i++) {
        if (
            !second.hasOwnProperty(firstKeys[i]) ||
            first[firstKeys[i]] !== second[firstKeys[i]]
        ) {
            return false;
        }
    }

    return true;
}

function mount(container, render, props) {
    const context = new Context();
    const block = new Block(render, props);

    context.enqueueEffect({
        commit() {
            container.appendChild(block.element);
        }
    });

    context.requestUpdate(block);
}

function App(props, context) {
    const [count, setCount] = context.useState(0);

    return context.html`
        <div>
            ${new Component(Counter, { count })}
            <div>
                <button
                    onclick="${(e) => { setCount(count + 1); }}">+1</button>
            </div>
        </div>
    `;
}

function Counter(props, context)  {
    return context.html`
        <div>
            <span class="count-label">COUNT: </span>
            <span class="count-value">${props.count}</span>
        </div>
    `;
}

mount(document.body, App, {});
