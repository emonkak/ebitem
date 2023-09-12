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

const BlockStatus = {
    INITIALIZED: 1,
    MOUNTED: 2,
    DIRTY: 3,
    INACTIVE: 4,
    UNMOUNTED: 5,
};

class Context {
    constructor() {
        this._currentBlock = null;
        this._pendingEffects = new RingBuffer(255);
        this._pendingBlocks = new RingBuffer(64);
        this._hookIndex = 0;
        this._templateCaches = new WeakMap();
        this._isRendering = false;
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
                        this.block.markAsDirty();
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
                commit(context) {
                    if (this.finalize) {
                        this.finalize(context);
                    }
                    this.finalize = this.perform(context);
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
                this._pendingBlocks.enqueue(block);
            }
        } else {
            this._currentBlock = block;
            if (!this._isRendering) {
                this._startRendering();
            }
        }
    }

    enqueueEffect(effect) {
        this._pendingEffects.enqueue(effect);
    }

    _startRendering() {
        this._isRendering = true;
        scheduler.postTask(this._background_loop, {
            'priority': 'background',
        });
    }

    _background_loop = () => {
        console.time('Background Loop')

        while (this._currentBlock) {
            this._hookIndex = 0;
            this._currentBlock.render(this);
            this._currentBlock = this._pendingBlocks.dequeue();
        }

        scheduler.postTask(this._user_blocking_loop, {
            'priority': 'user-blocking',
        });

        console.timeEnd('Background Loop');
    };

    _user_blocking_loop = () => {
        console.time('User Blocking Loop');

        let effect;

        while (effect = this._pendingEffects.dequeue()) {
            effect.commit(this);
        }

        this._isRendering = false;

        console.timeEnd('User Blocking Loop');
    };
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
                    const event = hole.attribute.slice(2);
                    part = new EventPart(child, event);
                } else {
                    part = new AttributePart(child, hole.attribute);
                }
            } else {  //  hole.type === 'child'
                part = new ChildPart(child);
            }

            part.setValue(value, context);

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

            part.setValue(newValue, context);
        }
    }
}

class AttributePart {
    constructor(element, attribute) {
        this._element = element;
        this._attribute = attribute;
        this._commitedValue = null;
        this._pendingValue = null;
    }

    get node() {
        return this._element;
    }

    get value() {
        return this._commitedValue;
    }

    setValue(value, context) {
        if (value instanceof Directive) {
            value.handle(this, context);
        } else {
            this._pendingValue = value;
            context.enqueueEffect(this);
        }
    }

    commit(_context) {
        const {
            _element: element,
            _attribute: attribute,
            pendingValue: value,
        } = this;

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
        this._element = element;
        this._event = event;
        this._commitedValue = null;
        this._pendingValue = null;
    }

    get node() {
        return this._element;
    }

    get value() {
        return this._commitedValue;
    }

    setValue(newValue, context) {
        if (newValue instanceof Directive) {
            newValue.handle(this, context);
        } else {
            this._pendingValue = newValue;
            context.enqueueEffect(this);
        }
    }

    commit(_context) {
        const {
            _element: element,
            _event: event,
            _commitedValue: oldValue,
            _pendingValue: newValue
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
        this._node = node;
        this._commitedValue = null;
        this._pendingValue = null;
    }

    get node() {
        return this._node;
    }

    get value() {
        return this._commitedValue;
    }

    setValue(newValue, context) {
        if (newValue instanceof Directive) {
            newValue.handle(this, context);
        } else {
            this._pendingValue = Child.fromValue(newValue);
            context.enqueueEffect(this);
        }
    }

    commit(_context) {
        const oldValue = this._commitedValue;
        const newValue = this._pendingValue;

        if (oldValue !== newValue) {
            if (oldValue) {
                oldValue.unmount(this);
            }
            newValue.mount(this);
        }

        newValue.commit(this);

        this._commitedValue = newValue;
    }
}

class ItemPart {
    constructor(node, referencePart) {
        this._node = node;
        this._commitedValue = null;
        this._commitedReferencePart = null;
        this._pendingValue = null;
        this._pendingReferencePart = referencePart;
    }

    get node() {
        return _node;
    }

    get value() {
        return this._commitedValue;
    }

    setValue(newValue, context) {
        if (newValue instanceof Directive) {
            newValue.handle(this, context);
        } else {
            this._pendingValue = Child.fromValue(newValue);
            context.enqueueEffect(this);
        }
    }

    setReferencePart(newReferencePart) {
        this._pendingReferencePart = newReferencePart;
    }

    commit(_context) {
        const oldValue = this._commitedValue;
        const newValue = this._pendingValue;
        const oldReferencePart = this._commitedReferencePart;
        const newReferencePart = this._pendingReferencePart;

        if (oldReferencePart === newReferencePart) {
            if (oldValue !== newValue) {
                if (oldValue) {
                    oldValue.unmount(this);
                }
                newValue.mount(this);
            }
        } else {
            if (oldValue !== newValue) {
                if (oldValue) {
                    oldValue.unmount(this);
                }
            }
            this._commitedReferencePart = newReferencePart;
            newValue.mount(this);
        }

        newValue.commit(this);

        this._commitedValue = newValue;
    }

    remove() {
        if (this._commitedValue) {
            this._commitedValue.unmount(part)
        }
        this._node.remove();
    }
}

class Child {
    static fromValue(value) {
        if (value instanceof Child) {
            return value;
        }
        if (value == null) {
            return None.instance;
        }
        return new Text(value);
    }

    mount(_containerPart) {
    }

    unmount(_containerPart) {
    }

    commit(_containerPart) {
    }
}

class Text extends Child {
    constructor(value) {
        super();
        this._value = value;
        this._node = document.createTextNode('');
    }

    get value() {
        return this._value;
    }

    setValue(newValue) {
        this._value = newValue;
    }

    mount(containerPart) {
        const container = containerPart.node;
        container.parentNode.insertBefore(this._node, container);
    }

    unmount(_containerPart) {
        this._node.remove();
    }

    commit(_containerPart) {
        this._node.textContent = this._value.toString();
    }
}

class None extends Child {
    static instance = new None();

    mount(_containerPart) {
    }

    unmount(_containerPart) {
    }

    commit(_containerPart) {
    }
}

class Block extends Child {
    constructor(type, props) {
        super();
        this._type = type;
        this._pendingProps = props;
        this._memoizedProps = props;
        this._status = BlockStatus.INITIALIZED;
        this._nodes = [];
        this._parts = [];
        this._values = [];
        this._hooks = [];
    }

    get type() {
        return this._type;
    }

    get props() {
        return this._memoizedProps;
    }

    get nodes() {
        return this._nodes;
    }

    get hooks() {
        return this._hooks;
    }

    setProps(newProps) {
        this._pendingProps = newProps;
    }

    markAsDirty() {
        this._status = BlockStatus.DIRTY;
    }

    markAsInactive() {
        this._status = BlockStatus.INACTIVE;
    }

    render(context) {
        if (this._status === BlockStatus.INITIALIZED) {
            const { template, values } = this._type(this._pendingProps, context);
            const { element, parts } = template.mount(values, context);
            this._memoizedProps = this._pendingProps;
            this._nodes = Array.from(element.childNodes);
            this._parts = parts;
            this._values = values;
            this._status = BlockStatus.MOUNTED;
        } else if (this._status === BlockStatus.DIRTY) {
            const { template, values } = this._type(this._pendingProps, context);
            template.patch(this._parts, this._values, values, context)
            this._memoizedProps = this._pendingProps;
            this._values = values;
            this._status = BlockStatus.MOUNTED;
        } else if (this._status === BlockStatus.INACTIVE) {
            for (let i = 0, l = this._hooks.length; i < l; i++) {
                const hook = this._hooks[i];
                if (hook.finalize) {
                    hook.finalize();
                }
            }
            this._status = BlockStatus.UNMOUNTED;
        }
    }

    commit(_containerPart) {
    }

    mount(containerPart) {
        const container = containerPart.node;
        const parent = container.parentNode;

        for (const node of this._nodes) {
            parent.insertBefore(node, container);
        }
    }

    unmount(_containerPart) {
        for (const node of this._nodes) {
            node.remove();
        }
    }
}

class List extends Child {
    constructor(values, keySelector, containerPart, context) {
        super();
        const parts = new Array(values.length);
        const keys = new Array(values.length);
        for (let i = 0, l = values.length; i < l; i++) {
            const value = values[i];
            const key = keySelector(value, i);
            const part = new ItemPart(createMaker(), key, containerPart);
            part.setValue(value, context);
            parts[i] = part;
            keys[i] = key;
        }
        this._containerPart = containerPart;
        this._commitedParts = [];
        this._commitedKeys = [];
        this._pendingParts = parts;
        this._pendingKeys = keys;
    }

    setValues(newValues, keySelector, context) {
        const oldParts = this._commitedParts;
        const oldKeys = this._commitedKeys;
        const newParts = new Array(values.length);
        const newKeys = newValues.map(keySelector);

        // Head and tail pointers to old parts and new values
        let oldHead = 0;
        let oldTail = oldParts.length - 1;
        let newHead = 0;
        let newTail = newValues.length - 1;

        let newKeyToIndexMap;
        let oldKeyToIndexMap;

        while (oldHead <= oldTail && newHead <= newTail) {
            if (oldParts[oldHead] === null) {
                // `null` means old part at head has already been used
                // below; skip
                oldHead++;
            } else if (oldParts[oldTail] === null) {
                // `null` means old part at tail has already been used
                // below; skip
                oldTail--;
            } else if (oldKeys[oldHead] === newKeys[newHead]) {
                // Old head matches new head; update in place
                const part = oldParts[oldHead];
                part.setValue(newValues[newHead], context);
                newParts[newHead] = part;
                oldHead++;
                newHead++;
            } else if (oldKeys[oldTail] === newKeys[newTail]) {
                // Old tail matches new tail; update in place
                const part = oldParts[oldTail];
                part.setValue(newValues[newTail], context);
                newParts[newTail] = part;
                oldTail--;
                newTail--;
            } else if (oldKeys[oldHead] === newKeys[newTail]) {
                // Old tail matches new head; update and move to new head
                const part = oldParts[oldHead];
                part.setReferencePart(newParts[newTail + 1] ?? this._containerPart);
                part.setValue(newValues[newTail], context);
                newParts[newTail] = part;
                oldHead++;
                newTail--;
            } else if (oldKeys[oldTail] === newKeys[newHead]) {
                // Old tail matches new head; update and move to new head
                const part = oldParts[oldTail];
                part.setReferencePart(oldParts[oldHead]);
                part.setValue(newValues[newHead], context);
                newParts[newHead] = part;
                oldTail--;
                newHead++;
            } else {
                if (newKeyToIndexMap === undefined) {
                    // Lazily generate key-to-index maps, used for removals &
                    // moves below
                    newKeyToIndexMap = generateMap(newKeys, newHead, newTail);
                    oldKeyToIndexMap = generateMap(oldKeys, oldHead, oldTail);
                }
                if (!newKeyToIndexMap.has(oldKeys[oldHead])) {
                    // Old head is no longer in new list; remove
                    const part = oldParts[oldHead];
                    context.enqueueEffect(new RemoveItemPart(part));
                    oldHead++;
                } else if (!newKeyToIndexMap.has(oldKeys[oldTail])) {
                    // Old tail is no longer in new list; remove
                    const part = oldParts[oldTail];
                    context.enqueueEffect(new RemoveItemPart(part));
                    oldTail--;
                } else {
                    // Any mismatches at this point are due to additions or
                    // moves; see if we have an old part we can reuse and move
                    // into place
                    const oldIndex = oldKeyToIndexMap.get(newKeys[newHead]);
                    const oldPart = oldIndex !== undefined ? oldParts[oldIndex] : null;
                    if (oldPart === null) {
                        // No old part for this value; create a new one and
                        // insert it
                        const part = new ItemPart(
                            createMaker(),
                            newKeys[newHead],
                            oldParts[oldHead]
                        );
                        part.setValue(newValues[newHead], context);
                        newParts[newHead] = part;
                    } else {
                        // Reuse old part
                        newParts[newHead] = oldPart;
                        oldPart.setReferencePart(oldParts[oldHead]);
                        oldPart.setValue(newValues[newHead], context);
                        // This marks the old part as having been used, so that
                        // it will be skipped in the first two checks above
                        oldParts[oldIndex] = null;
                    }
                    newHead++;
                }
            }
        }

        // Add parts for any remaining new values
        while (newHead <= newTail) {
            // For all remaining additions, we insert before last new
            // tail, since old pointers are no longer valid
            const newPart = new ItemPart(
                createMaker(),
                newKeys[newHead],
                this._containerPart,
            );
            newPart.setValue(newValues[newHead], context);
            newParts[newHead++] = newPart;
        }

        // Remove any remaining unused old parts
        while (oldHead <= oldTail) {
            const oldPart = oldParts[oldHead++];
            if (oldPart !== null) {
                context.enqueueEffect(new RemoveItemPart(oldPart));
            }
        }

        this._pendingParts = newParts;
        this._pendingKeys = newKeys;
    }

    mount(_containerPart) {
    }

    unmount(_containerPart) {
    }

    commit(_containerPart) {
        const newParts = this._pendingParts;
        const newKeys = this._pendingKeys;

        this._commitedParts = newParts;
        this._commitedKeys = newKeys;
    }
}

class RemoveItemPart {
    constructor(part) {
        this._part = part;
    }

    commit(_context) {
        this._part.remove();
    }
}

class Directive {
    handle(_part, _context) {
    }
}

class Component extends Directive {
    constructor(render, props) {
        super();
        this._render = render;
        this._props = props;
    }

    handle(part, context) {
        const child = part.value;

        let shouldMount;

        if (child instanceof Block) {
            if (child.type === this._render) {
                child.setProps(this._props);
                child.markAsDirty();
                shouldMount = false;
            } else {
                child.markAsInactive();
                shouldMount = true;
            }

            context.requestUpdate(child);
        } else {
            shouldMount = true;
        }

        if (shouldMount) {
            const newBlock = new Block(this._render, this._props);

            part.setValue(newBlock, context);

            context.enqueueEffect(part);
            context.requestUpdate(newBlock);
        }
    }
}

class For extends Directive {
    constructor(values, keySelector) {
        super();
        this._values = values;
        this._keySelector = keySelector ?? ((_value, index) => index);
    }

    handle(part, context) {
        const value = part.value;

        if (value instanceof List) {
            value.setValues(this._values, this._keySelector, context);
        } else {
            const list = new List(this._values, this._keySelector, part, context);
            part.setValue(list, context);
        }

        context.enqueueEffect(part);
    }
}

class RingBuffer {
    constructor(size) {
        this._buffer = new Array(size);
        this._read_index = 0;
        this._write_index = 0;
    }

    get length() {
        return this._write_index - this._read_index;
    }

    isEmpty() {
        return this._write_index === this._read_index;
    }

    enqueue(value) {
        if (this._write_index - this._read_index === this._buffer.length) {
            this.extend(this._buffer.length * 2);
        }
        this._buffer[this._write_index % this._buffer.length] = value;
        this._write_index++;
        return true;
    }

    dequeue() {
        if (this._write_index == this._read_index) {
            return;
        }
        const index = this._read_index % this._buffer.length;
        const value = this._buffer[index];
        delete this._buffer[index];
        this._read_index++;
        return value;
    }

    extend(newSize) {
        if (newSize <= this._buffer.length) {
            return;
        }

        const newBuffer = new Array(newSize);
        let count = 0;

        while (!this.isEmpty()) {
            newBuffer[count] = this.dequeue();
            count++;
        }

        this._buffer = newBuffer;
        this._read_index = 0;
        this._write_index = count;
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
    return strings
        .join(HOLE_COMMENT)
        .replace(TAG_PATTERN, replaceTag)
        .trim();
}

function parseHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template;
}

function replaceTag(_$0, $1, $2, $3) {
    return $1 + $2.replace(ATTRIBUTE_HOLE_PATTERN, replaceHoleInAttributes) + $3;
}

function replaceHoleInAttributes(_$0, $1, _$2) {
    return $1 + '"' + HOLE + '"';
}

function parseChildren(node, holes, path) {
    const { childNodes } = node;

    for (let i = 0, l = childNodes.length; i < l; i++) {
        const child = childNodes[i];
        switch (child.nodeType) {
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

function createMaker() {
    return document.createComment('');
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

function generateMap(list, start, end) {
    const map = new Map();
    for (let i = start; i <= end; i++) {
        map.set(list[i], i);
    }
    return map;
}

function boot(container, block) {
    const context = new Context();

    context.enqueueEffect({
        commit() {
            block.nodes.forEach((node) => container.appendChild(node));
        }
    });

    context.requestUpdate(block);
}

function App(_props, context) {
    const [count, setCount] = context.useState(0);

    return context.html`
        <div>
            ${new Component(Counter, { count })}
            <div>
                <button
                    onclick="${(_e) => { setCount(count + 1); }}">+1</button>
            </div>
        </div>
    `;
}

function Counter(props, context) {
    return context.html`
        <div>
            <span class="count-label">COUNT: </span>
            <span class="count-value">${props.count}</span>
        </div>
    `;
}

boot(document.body, new Block(App, {}));
