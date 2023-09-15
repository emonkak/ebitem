const HOLE_UUID = getUUID();
const HOLE_MAKER = '{{' + HOLE_UUID + '}}';

const BlockStatus = {
    INITIALIZED: 1,
    MOUNTED: 2,
    DIRTY: 3,
    REMOVED: 4,
    UNMOUNTED: 5,
};

class Context {
    constructor() {
        this._currentBlock = null;
        this._pendingMutationEffects = new RingBuffer(255);
        this._pendingLayoutEffects = new RingBuffer(255);
        this._pendingPassiveEffects = new RingBuffer(255);
        this._pendingBlocks = new RingBuffer(255);
        this._hookIndex = 0;
        this._templateCaches = new WeakMap();
        this._isRendering = false;
    }

    html(strings, ...values) {
        let template = this._templateCaches.get(strings);

        if (!template) {
            template = Template.parse(strings);
            this._templateCaches.set(strings, template);
        }

        return {
            template,
            values,
        };
    }

    useCallback(callback, dependencies) {
        return this.useMemo(() => callback, dependencies);
    }

    useEffect(setup, dependencies) {
        const hooks = this._currentBlock.hooks;
        let hook = hooks[this._hookIndex];

        if (hook) {
            if (dependencies === undefined ||
                !shallowEqual(hook.dependencies, dependencies)) {
                this.enqueuePassiveEffect(hook);
            }
            hook.setup = setup;
            hook.dependencies = dependencies;
        } else {
            hooks[this._hookIndex] = hook = new HookEffect(setup, dependencies);
            this.enqueuePassiveEffect(hook);
        }

        this._hookIndex++;
    }

    useEvent(handler) {
        const handlerRef = this.useRef(null);

        this.useLayoutEffect(() => {
            handlerRef.current = handler;
        });

        return this.useCallback((...args) => {
            const currentHandler = handlerRef.current;
            return currentHandler(...args);
        }, []);
    }

    useLayoutEffect(setup, dependencies) {
        const hooks = this._currentBlock.hooks;
        let hook = hooks[this._hookIndex];

        if (hook) {
            if (dependencies === undefined ||
                !shallowEqual(hook.dependencies, dependencies)) {
                this.enqueueLayoutEffect(hook);
            }
            hook.setup = setup;
            hook.dependencies = dependencies;
        } else {
            hooks[this._hookIndex] = hook = new HookEffect(setup, dependencies);
            this.enqueueLayoutEffect(hook);
        }

        this._hookIndex++;
    }

    useMemo(create, dependencies) {
        const hooks = this._currentBlock.hooks;
        let hook = hooks[this._hookIndex];

        if (hook) {
            if (dependencies === undefined ||
                !shallowEqual(hook.dependencies, dependencies)) {
                hook.value = create();
            }
            hook.dependencies = dependencies;
        } else {
            hooks[this._hookIndex] = hook = {
                value: create(),
                dependencies,
            };
        }

        this._hookIndex++;

        return hook.value;
    }

    useRef(initialValue) {
        const hooks = this._currentBlock.hooks;
        let hook = hooks[this._hookIndex];

        if (!hook) {
            hooks[this._hookIndex] = hook = new Ref(initialValue);
        }

        this._hookIndex++;

        return hook;
    }

    useState(initialState) {
        const block = this._currentBlock;
        const hooks = block.hooks;
        let hook = hooks[this._hookIndex];

        if (!hook) {
            hooks[this._hookIndex] = hook = {
                state: initialState,
                setState: (newState) => {
                    if (!Object.is(hook.state, newState)) {
                        hook.state = newState;
                        block.markAsDirty();
                        this.requestUpdate(block);
                    }
                },
            };
        }

        this._hookIndex++;

        return [hook.state, hook.setState];
    }

    requestUpdate(block) {
        if (this._currentBlock) {
            if (this._currentBlock !== block) {
                this._pendingBlocks.enqueue(block);
            }
        } else {
            this._pendingBlocks.enqueue(block);
            this._startRendering();
        }
    }

    enqueueMutationEffect(effect) {
        this._pendingMutationEffects.enqueue(effect);
    }

    enqueueLayoutEffect(effect) {
        this._pendingLayoutEffects.enqueue(effect);
    }

    enqueuePassiveEffect(effect) {
        this._pendingPassiveEffects.enqueue(effect);
    }

    _startRendering() {
        if (this._isRendering) {
            return;
        }
        this._isRendering = true;
        scheduler.postTask(this._renderingPhase, {
            'priority': 'background',
        });
    }

    _renderingPhase = async () => {
        console.time('Rendering phase')

        while (this._currentBlock = this._pendingBlocks.dequeue() ?? null) {
            if (navigator.scheduling.isInputPending()) {
                await yieldToMain();
            }
            this._hookIndex = 0;
            this._currentBlock.render(this);
        }

        scheduler.postTask(this._blockingPhase, {
            'priority': 'user-blocking',
        });

        console.timeEnd('Rendering phase');
    };

    _blockingPhase = async () => {
        console.time('Blocking phase');

        let effect;

        while (effect = this._pendingMutationEffects.dequeue()) {
            if (navigator.scheduling.isInputPending()) {
                await yieldToMain();
            }
            effect.commit();
        }

        while (effect = this._pendingLayoutEffects.dequeue()) {
            if (navigator.scheduling.isInputPending()) {
                await yieldToMain();
            }
            effect.commit();
        }

        scheduler.postTask(this._passiveEffectPhase, {
            'priority': 'background',
        });

        console.timeEnd('Blocking phase');
    };

    _passiveEffectPhase = async () => {
        console.time('Passive effect phase');

        let effect;

        while (effect = this._pendingPassiveEffects.dequeue()) {
            if (navigator.scheduling.isInputPending()) {
                await yieldToMain();
            }
            effect.commit();
        }

        if (this._pendingBlocks.isEmpty()) {
            this._isRendering = false;
        } else {
            scheduler.postTask(this._renderingPhase, {
                'priority': 'background',
            });
        }

        console.timeEnd('Passive effect phase');
    };
}

class Template {
    static parse(strings) {
        const html = strings.join(HOLE_MAKER);
        const template = document.createElement('template');
        template.innerHTML = html;
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

            if (Object.is(oldValue, newValue)) {
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

    setValue(newValue, context) {
        if (newValue instanceof Directive) {
            newValue.handle(this, context);
        } else {
            this._pendingValue = newValue;
            context.enqueueMutationEffect(this);
        }
    }

    commit() {
        const {
            _element: element,
            _attribute: attribute,
            _pendingValue: newValue,
        } = this;

        if (newValue === true) {
            element.setAttribute(attribute, '');
        } else if (newValue === false || newValue == null) {
            element.removeAttribute(attribute);
        } else {
            element.setAttribute(attribute, newValue.toString());
        }

        this._commitedValue = newValue;
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
            context.enqueueMutationEffect(this);
        }
    }

    commit() {
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

        this._commitedValue = newValue;
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
            context.enqueueMutationEffect(this);
        }
    }

    commit() {
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
            context.enqueueMutationEffect(this);
        }
    }

    setReferencePart(newReferencePart) {
        this._pendingReferencePart = newReferencePart;
    }

    commit() {
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

    markAsRemoved() {
        this._status = BlockStatus.REMOVED;
    }

    render(context) {
        if (this._status === BlockStatus.INITIALIZED) {
            const render = this._type;
            const { template, values } = render(this._pendingProps, context);
            const { element, parts } = template.mount(values, context);
            this._memoizedProps = this._pendingProps;
            this._nodes = [...element.childNodes];
            this._parts = parts;
            this._values = values;
            this._status = BlockStatus.MOUNTED;
        } else if (this._status === BlockStatus.DIRTY) {
            const render = this._type;
            const { template, values } = render(this._pendingProps, context);
            template.patch(this._parts, this._values, values, context)
            this._memoizedProps = this._pendingProps;
            this._values = values;
            this._status = BlockStatus.MOUNTED;
        } else if (this._status === BlockStatus.REMOVED) {
            for (let i = 0, l = this._hooks.length; i < l; i++) {
                const hook = this._hooks[i];
                if (hook instanceof HookEffect && hook.clean) {
                    hook.clean();
                }
            }
            this._status = BlockStatus.UNMOUNTED;
        }
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

    commit(_containerPart) {
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
                    context.enqueueMutationEffect(new RemoveItemPart(part));
                    oldHead++;
                } else if (!newKeyToIndexMap.has(oldKeys[oldTail])) {
                    // Old tail is no longer in new list; remove
                    const part = oldParts[oldTail];
                    context.enqueueMutationEffect(new RemoveItemPart(part));
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
                context.enqueueMutationEffect(new RemoveItemPart(oldPart));
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

class Directive {
    handle(_part, _context) {
    }
}

class BlockDirective extends Directive {
    constructor(type, props) {
        super();
        this._type = type;
        this._props = props;
    }

    handle(part, context) {
        const child = part.value;

        let shouldMount;

        if (child instanceof Block) {
            if (child.type === this._type) {
                child.setProps(this._props);
                child.markAsDirty();
                shouldMount = false;
            } else {
                child.markAsRemoved();
                shouldMount = true;
            }

            context.requestUpdate(child);
        } else {
            shouldMount = true;
        }

        if (shouldMount) {
            const newBlock = new Block(this._type, this._props);

            part.setValue(newBlock, context);

            context.enqueueMutationEffect(part);
            context.requestUpdate(newBlock);
        }
    }
}

class ListDirective extends Directive {
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

        context.enqueueMutationEffect(part);
    }
}

class Ref extends Directive {
    constructor(initialValue) {
        super();
        this.current = initialValue;
    }

    handle(part) {
        this.current = part.node;
    }
}

class HookEffect {
    constructor(setup, dependencies) {
        this.setup = setup;
        this.dependencies = dependencies;
        this.clean = null;
    }

    commit() {
        if (this.clean) {
            this.clean();
        }
        this.clean = this.setup();
    }
}

class RemoveItemPart {
    constructor(part) {
        this._part = part;
    }

    commit() {
        this._part.remove();
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
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    return s.slice(0, 8) + '-' +
        s.slice(8, 12) + '-' +
        s.slice(12, 16) + '-' +
        s.slice(16, 20) + '-' +
        s.slice(20, 32);
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
            case Node.TEXT_NODE: {
                const components = child.data.split(HOLE_MAKER);
                if (components.length <= 1) {
                    continue;
                }

                const componentEnd = components.length - 1;
                for (let j = 0; j < componentEnd; j++) {
                    if (components[j] !== '') {
                        const text = document.createTextNode(components[j]);
                        node.insertBefore(text, child);
                        i++;
                        l++;
                    }

                    holes.push({
                        type: 'child',
                        path,
                        index: i + j,
                    });

                    node.insertBefore(createMaker(), child);
                    i++;
                    l++;
                }

                if (components[componentEnd] !== '') {
                    child.data = components[componentEnd];
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

function parseAttribtues(node, holes, path, index) {
    const { attributes } = node;
    for (let i = 0, l = attributes.length; i < l; i++) {
        const attribute = attributes[i];
        if (attribute.value === HOLE_MAKER) {
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
    if (Object.is(first, second)) {
        return true;
    }

    if (
        typeof first !== 'object' || first === null ||
        typeof second !== 'object' || second === null
    ) {
        return false;
    }

    if (Object.getPrototypeOf(first) !== Object.getPrototypeOf(second)) {
        return false;
    }

    const firstKeys = Object.keys(first);
    const secondKeys = Object.keys(second);

    if (firstKeys.length !== secondKeys.length) {
        return false;
    }

    for (let i = 0, l = firstKeys.length; i < l; i++) {
        if (
            !Object.prototype.hasOwnProperty.call(second, firstKeys[i]) ||
            !Object.is(first[firstKeys[i]], second[firstKeys[i]])
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

function yieldToMain() {
    if ('scheduler' in globalThis && 'yield' in scheduler) {
        return scheduler.yield();
    }

    return new Promise(resolve => {
        setTimeout(resolve, 0);
    });
}

function boot(container, block, context = new Context()) {
    context.enqueueLayoutEffect({
        commit() {
            for (const node of block.nodes) {
                container.appendChild(node);
            }
        }
    });

    context.requestUpdate(block);
}

function App(_props, context) {
    const [count, setCount] = context.useState(0);

    return context.html`
        <div>
            ${new BlockDirective(Counter, { count })}
            <div>
                <button
                    onclick="${context.useEvent((_e) => { setCount(count + 1); })}">+1</button>
            </div>
        </div>
    `;
}

function Counter(props, context) {
    const countLabelRef = context.useRef(null);

    return context.html`
        <div>
            <span class="count-label" ref=${countLabelRef}>COUNT: </span>
            <span class="count-value" data-count=${props.count}>${props.count}</span>
        </div>
    `;
}

if (typeof document === 'object') {
    boot(document.body, new Block(App, {}));
}
