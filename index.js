const HOLE_UUID = getUUID();
const HOLE_MAKER = '{{' + HOLE_UUID + '}}';

const BlockStatus = {
    INITIALIZED: 1,
    MOUNTED: 2,
    DIRTY: 3,
    CLEANING: 4,
    UNMOUNTED: 5,
};

class Context {
    constructor() {
        this._currentBlock = null;
        this._pendingMutationEffects = [];
        this._pendingLayoutEffects = [];
        this._pendingPassiveEffects = [];
        this._pendingBlocks = [];
        this._hookIndex = 0;
        this._envStack = new WeakMap();
        this._templateCaches = new WeakMap();
        this._isUpdating = false;
    }

    get currentBlock() {
        return this._currentBlock;
    }

    html(strings, ...values) {
        let template = this._templateCaches.get(strings);

        if (!template) {
            template = Template.parse(strings);
            this._templateCaches.set(strings, template);
        }

        return new TemplateResult(template, values);
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

    useEnv(name, defaultValue = null) {
        let parentBlock;
        while (parentBlock = this._currentBlock.parent) {
            const env = this._envStack.get(parentBlock);
            if (env && Object.hasOwnProperty.call(env, name)) {
                return env[name];
            }
        }
        return defaultValue;
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

    useReducer(reducer, initialState) {
        const block = this._currentBlock;
        const hooks = block.hooks;
        let hook = hooks[this._hookIndex];

        if (!hook) {
            hooks[this._hookIndex] = hook = {
                state: initialState,
                dispatch: (action) => {
                    hook.state = reducer(hook.state, action);
                    block.markAsDirty();
                    this.requestUpdate(block);
                },
            };
        }

        this._hookIndex++;

        return [hook.state, hook.dispatch];
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
        return this.useReducer(
            (state, action) =>
                typeof action === 'function' ? action(state) : action,
            initialState
        );
    }

    setEnv(env) {
        this._envStack.set(this._currentBlock, env);
    }

    requestUpdate(block) {
        if (this._currentBlock) {
            if (this._currentBlock !== block) {
                this._pendingBlocks.push(block);
            }
        } else {
            this._pendingBlocks.push(block);
            if (!this._isUpdating) {
                this._isUpdating = true;
                scheduler.postTask(this._renderingPhase, {
                    'priority': 'background',
                });
            }
        }
    }

    enqueueMutationEffect(effect) {
        this._pendingMutationEffects.push(effect);
    }

    enqueueLayoutEffect(effect) {
        this._pendingLayoutEffects.push(effect);
    }

    enqueuePassiveEffect(effect) {
        this._pendingPassiveEffects.push(effect);
    }

    _renderingPhase = async () => {
        console.time('Rendering phase')

        for (let i = 0; i < this._pendingBlocks.length; i++) {
            if (navigator.scheduling.isInputPending()) {
                await yieldToMain();
            }
            this._hookIndex = 0;
            this._currentBlock = this._pendingBlocks[i];
            this._currentBlock.render(this);
            this._currentBlock = null;
        }

        this._pendingBlocks.length = 0;

        scheduler.postTask(this._blockingPhase, {
            'priority': 'user-blocking',
        });

        console.timeEnd('Rendering phase');
    };

    _blockingPhase = async () => {
        console.time('Blocking phase');

        for (let i = 0; i < this._pendingMutationEffects.length; i++) {
            if (navigator.scheduling.isInputPending()) {
                await yieldToMain();
            }
            const effect = this._pendingMutationEffects[i];
            effect.commit(this);
        }

        this._pendingMutationEffects.length = 0;

        for (let i = 0; i < this._pendingLayoutEffects.length; i++) {
            if (navigator.scheduling.isInputPending()) {
                await yieldToMain();
            }
            const effect = this._pendingLayoutEffects[i];
            effect.commit(this);
        }

        this._pendingLayoutEffects.length = 0;

        scheduler.postTask(this._passiveEffectPhase, {
            'priority': 'background',
        });

        console.timeEnd('Blocking phase');
    };

    _passiveEffectPhase = async () => {
        console.time('Passive effect phase');

        for (let i = 0; i < this._pendingPassiveEffects.length; i++) {
            if (navigator.scheduling.isInputPending()) {
                await yieldToMain();
            }
            const effect = this._pendingPassiveEffects[i];
            effect.commit(this);
        }

        this._pendingPassiveEffects.length = 0;

        if (this._pendingBlocks.length > 0) {
            scheduler.postTask(this._renderingPhase, {
                'priority': 'background',
            });
        } else {
            this._isUpdating = false;
        }

        console.timeEnd('Passive effect phase');
    };
}

class Template {
    static parse(strings) {
        const html = strings.join(HOLE_MAKER).trim();
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
        const node = this._template.content.cloneNode(true);
        const parts = new Array(this._holes.length);

        for (let i = 0, l = this._holes.length; i < l; i++) {
            const hole = this._holes[i];

            let child = node;

            for (let j = 0, m = hole.path.length; j < m; j++) {
                child = child.childNodes[hole.path[j]];
            }

            child = child.childNodes[hole.index];

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

            updatePart(part, values[i], context);

            parts[i] = part;
        }

        return { node, parts };
    }

    patch(parts, values, context) {
        for (let i = 0, l = this._holes.length; i < l; i++) {
            updatePart(parts[i], values[i], context);
        }
    }
}

class AttributePart {
    constructor(element, attribute) {
        this._element = element;
        this._attribute = attribute;
        this._committedValue = null;
        this._pendingValue = null;
    }

    get node() {
        return this._element;
    }

    get value() {
        return this._committedValue;
    }

    setValue(newValue, context) {
        if (newValue === this._committedValue) {
            return false;
        }
        if (newValue instanceof Directive) {
            return newValue.handle(this, context);
        }
        this._pendingValue = newValue;
        return true;
    }

    commit(_context) {
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

        this._committedValue = newValue;
    }
}

class EventPart {
    constructor(element, event) {
        this._element = element;
        this._event = event;
        this._committedValue = null;
        this._pendingValue = null;
    }

    get node() {
        return this._element;
    }

    get value() {
        return this._committedValue;
    }

    setValue(newValue, context) {
        if (newValue === this._committedValue) {
            return false;
        }
        if (newValue instanceof Directive) {
            return newValue.handle(this, context);
        }
        this._pendingValue = newValue;
        return true;
    }

    commit(_context) {
        const {
            _element: element,
            _event: event,
            _committedValue: oldValue,
            _pendingValue: newValue
        } = this;

        if (oldValue != null) {
            element.removeEventListener(event, oldValue);
        }

        if (newValue != null) {
            element.addEventListener(event, newValue);
        }

        this._committedValue = newValue;
    }
}

class ChildPart {
    constructor(endNode) {
        this._endNode = endNode;
        this._committedValue = null;
        this._pendingValue = null;
    }

    get startNode() {
        return this._committedValue ?
            this._committedValue.startNode ?? this._endNode :
            this._endNode;
    }

    get endNode() {
        return this._endNode;
    }

    get value() {
        return this._committedValue;
    }

    setValue(newValue, context) {
        if (newValue === this._committedValue) {
            return false;
        }
        if (newValue instanceof Directive) {
            return newValue.handle(this, context);
        }
        if (this._committedValue) {
            this._committedValue.clean(this, context);
        }
        this._pendingValue = Child.from(newValue);
        return true;
    }

    commit(context) {
        const oldValue = this._committedValue;
        const newValue = this._pendingValue;

        if (oldValue !== newValue) {
            if (oldValue) {
                oldValue.unmount(this, context);
            }
            newValue.mount(this, context);
        } else {
            newValue.update(this, context);
        }

        this._committedValue = newValue;
    }
}

class ItemPart {
    constructor(endNode, containerPart, referencePart) {
        this._endNode = endNode;
        this._containerPart = containerPart;
        this._referencePart = referencePart;
        this._committedValue = null;
        this._pendingValue = null;
        this._hasReordered = true;
    }

    get startNode() {
        return this._committedValue ?
            this._committedValue.startNode ?? this._endNode :
            this._endNode;
    }

    get endNode() {
        return this._endNode;
    }

    get value() {
        return this._committedValue;
    }

    setValue(newValue, context) {
        if (newValue === this._committedValue) {
            return this._hasReordered;
        }
        if (newValue instanceof Directive) {
            return newValue.handle(this, context) || this._hasReordered;
        }
        if (this._committedValue) {
            this._committedValue.clean(this, context);
        }
        this._pendingValue = Child.from(newValue);
        return true;
    }

    setReferencePart(newReferencePart) {
        this._referencePart = newReferencePart;
        this._hasReordered = true;
    }

    commit(context) {
        const oldValue = this._committedValue;
        const newValue = this._pendingValue;

        if (this._hasReordered) {
            const reference = this._referencePart ?
                this._referencePart.startNode :
                this._containerPart.endNode;
            reference.parentNode.insertBefore(this._endNode, reference);
        }

        if (oldValue !== newValue) {
            if (oldValue) {
                oldValue.unmount(this);
            }
            newValue.mount(this, context);
        } else {
            if (this._hasReordered) {
                newValue.mount(this, context);
            } else {
                newValue.update(this, context);
            }
        }

        this._committedValue = newValue;
        this._hasReordered = false;
    }

    remove(context) {
        if (this._committedValue) {
            this._committedValue.unmount(this, context)
        }
        this._endNode.remove();
    }
}

class Child {
    static from(value) {
        if (value instanceof Child) {
            return value;
        }
        if (value == null) {
            return None.instance;
        }
        return new Text(value);
    }

    get startNode() {
        return null;
    }

    get endNode() {
        return null;
    }

    mount(_containerPart, _context) {
    }

    update(_containerPart, _context) {
    }

    unmount(_containerPart, _context) {
    }

    clean(_containerPart, _context) {
    }
}

class Text extends Child {
    constructor(value) {
        super();
        this._value = value;
        this._node = document.createTextNode(value.toString());
    }

    get startNode() {
        return this._node;
    }

    get endNode() {
        return this._node;
    }

    get value() {
        return this._value;
    }

    setValue(newValue) {
        this._value = newValue;
    }

    mount(containerPart, _context) {
        const container = containerPart.endNode;
        container.parentNode.insertBefore(this._node, container);
    }

    update(_containerPart, _context) {
        this._node.textContent = this._value.toString();
    }

    unmount(_containerPart, _context) {
        this._node.remove();
    }
}

class None extends Child {
    static instance = new None();
}

class Fragment extends Child {
    constructor(template, values) {
        super();
        this._template = template;
        this._pendingValues = values;
        this._memoizedValues = values;
        this._nodes = [];
        this._parts = [];
    }

    get startNode() {
        return this._nodes[0] ?? null;
    }

    get endNode() {
        return this._nodes[this._nodes.length - 1] ?? null;
    }

    get template() {
        return this._template;
    }

    get values() {
        return this._memoizedValues;
    }

    setValues(values) {
        this._pendingValues = values;
    }

    mount(containerPart, _context) {
        const container = containerPart.endNode;
        const parent = container.parentNode;
        for (const node of this._nodes) {
            parent.insertBefore(node, container);
        }
    }

    update(_containerPart, _context) {
    }

    unmount(_containerPart, _context) {
        for (const node of this._nodes) {
            node.remove();
        }
    }

    render(context) {
        if (this._memoizedValues === this._pendingValues) {
            const { node, parts } = this._template.mount(
                this._pendingValues,
                context
            );
            this._nodes = [...node.childNodes];
            this._parts = parts;
        } else {
            this._template.patch(this._parts, this._pendingValues, context);
            this._memoizedValues = this._pendingValues;
        }
    }

    clean(_containerPart, context) {
        for (const part of this._parts) {
            if (part instanceof ChildPart) {
                cleanPart(part, context);
            }
        }
    }
}

class Block extends Child {
    constructor(type, props, parent = null) {
        super();
        this._type = type;
        this._pendingProps = props;
        this._memoizedProps = props;
        this._parent = parent;
        this._status = BlockStatus.INITIALIZED;
        this._nodes = [];
        this._parts = [];
        this._values = [];
        this._hooks = [];
    }

    get startNode() {
        return this._nodes[0] ?? null;
    }

    get endNode() {
        return this._nodes[this._nodes.length - 1] ?? null;
    }

    get type() {
        return this._type;
    }

    get props() {
        return this._memoizedProps;
    }

    get parent() {
        return this._parent;
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

    render(context) {
        if (this._status === BlockStatus.INITIALIZED) {
            const render = this._type;
            const { template, values } = render(this._pendingProps, context);
            const { node, parts } = template.mount(values, context);
            this._memoizedProps = this._pendingProps;
            this._nodes = [...node.childNodes];
            this._parts = parts;
            this._values = values;
            this._status = BlockStatus.MOUNTED;
        } else if (this._status === BlockStatus.DIRTY) {
            const render = this._type;
            const { template, values } = render(this._pendingProps, context);
            template.patch(this._parts, values, context)
            this._memoizedProps = this._pendingProps;
            this._values = values;
            this._status = BlockStatus.MOUNTED;
        } else if (this._status === BlockStatus.CLEANING) {
            for (let i = 0, l = this._hooks.length; i < l; i++) {
                const hook = this._hooks[i];
                if (hook instanceof HookEffect && hook.clean) {
                    hook.clean(context);
                    hook.clean = null;
                }
            }
            for (let i = 0, l = this._parts.length; i < l; i++) {
                const part = this._parts[i];
                if (part instanceof ChildPart) {
                    cleanPart(part, context);
                }
            }
            this._status = BlockStatus.UNMOUNTED;
        }
    }

    mount(containerPart, _context) {
        const container = containerPart.endNode;
        const parent = container.parentNode;

        for (const node of this._nodes) {
            parent.insertBefore(node, container);
        }
    }

    update(_containerPart, _context) {
    }

    unmount(_containerPart, _context) {
        for (const node of this._nodes) {
            node.remove();
        }
    }

    clean(_containerPart, context) {
        this._status = BlockStatus.CLEANING;
        context.requestUpdate(this);
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
            const part = new ItemPart(createMaker(), containerPart, null);
            updatePart(part, value, context);
            parts[i] = part;
            keys[i] = key;
        }
        this._containerPart = containerPart;
        this._commitedParts = parts;
        this._commitedKeys = keys;
        this._pendingParts = parts;
        this._pendingKeys = keys;
    }

    get startNode() {
        const parts = this._commitedParts;
        return parts.length > 0 ? parts[0].startNode : null;
    }

    get endNode() {
        const parts = this._commitedParts;
        return parts.length > 0 ? parts[parts.length - 1].endNode : null;
    }

    setValues(newValues, keySelector, context) {
        const oldParts = this._commitedParts;
        const oldKeys = this._commitedKeys;
        const newParts = new Array(newValues.length);
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
                updatePart(part, newValues[newHead], context);
                newParts[newHead] = part;
                oldHead++;
                newHead++;
            } else if (oldKeys[oldTail] === newKeys[newTail]) {
                // Old tail matches new tail; update in place
                const part = oldParts[oldTail];
                updatePart(part, newValues[newTail], context);
                newParts[newTail] = part;
                oldTail--;
                newTail--;
            } else if (oldKeys[oldHead] === newKeys[newTail]) {
                // Old tail matches new head; update and move to new head
                const part = oldParts[oldHead];
                part.setReferencePart(newParts[newTail + 1] ?? null);
                updatePart(part, newValues[newTail], context);
                newParts[newTail] = part;
                oldHead++;
                newTail--;
            } else if (oldKeys[oldTail] === newKeys[newHead]) {
                // Old tail matches new head; update and move to new head
                const part = oldParts[oldTail];
                part.setReferencePart(oldParts[oldHead]);
                updatePart(part, newValues[newHead], context);
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
                    cleanPart(part, context);
                    context.enqueueMutationEffect(new RemoveItemPart(part));
                    oldHead++;
                } else if (!newKeyToIndexMap.has(oldKeys[oldTail])) {
                    // Old tail is no longer in new list; remove
                    const part = oldParts[oldTail];
                    cleanPart(part, context);
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
                            this._containerPart,
                            oldParts[oldHead]
                        );
                        updatePart(part, newValues[newHead], context);
                        newParts[newHead] = part;
                    } else {
                        // Reuse old part
                        newParts[newHead] = oldPart;
                        oldPart.setReferencePart(oldParts[oldHead]);
                        updatePart(oldPart, newValues[newHead], context);
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
                this._containerPart,
                null
            );
            updatePart(newPart, newValues[newHead], context);
            newParts[newHead++] = newPart;
        }

        // Remove any remaining unused old parts
        while (oldHead <= oldTail) {
            const oldPart = oldParts[oldHead++];
            if (oldPart !== null) {
                cleanPart(oldPart, context);
                context.enqueueMutationEffect(new RemoveItemPart(oldPart));
            }
        }

        this._pendingParts = newParts;
        this._pendingKeys = newKeys;
    }

    mount(_containerPart) {
    }

    update(_containerPart) {
        this._commitedParts = this._pendingParts;
        this._commitedKeys = this._pendingKeys;
    }

    unmount(_containerPart) {
        for (const part of this._commitedParts) {
            part.unmount();
        }
    }

    clean(_containerPart, context) {
        for (const part of this._commitedParts) {
            cleanPart(part.value.clean(part, context));
        }
    }
}

class Directive {
    handle(_part, _context) {
        return false;
    }
}

class BlockDirective extends Directive {
    constructor(type, props) {
        super();
        this._type = type;
        this._props = props;
    }

    get type() {
        return this._type;
    }

    get props() {
        return this._props;
    }

    handle(part, context) {
        const value = part.value;

        let needsMount = false;
        let hasChanged = false;

        if (value instanceof Block) {
            if (value.type === this._type) {
                value.setProps(this._props);
                value.markAsDirty();
                context.requestUpdate(value);
            } else {
                value.clean(part, context);
                needsMount = true;
            }
        } else {
            needsMount = true;
        }

        if (needsMount) {
            const newBlock = new Block(
                this._type,
                this._props,
                context.currentBlock
            );

            hasChanged = part.setValue(newBlock, context);

            context.requestUpdate(newBlock);
        }

        return hasChanged;
    }
}

class ListDirective extends Directive {
    constructor(values, keySelector) {
        super();
        this._values = values;
        this._keySelector = keySelector;
    }

    handle(part, context) {
        const value = part.value;

        if (value instanceof List) {
            value.setValues(this._values, this._keySelector, context);
            return true;
        } else {
            const list = new List(
                this._values,
                this._keySelector,
                part,
                context
            );
            return part.setValue(list, context);
        }
    }
}

class TemplateResult extends Directive {
    constructor(template, values) {
        super();
        this._template = template;
        this._values = values;
    }

    get template() {
        return this._template;
    }

    get values() {
        return this._values;
    }

    handle(part, context) {
        const value = part.value;

        let needsMount = false;
        let hasChanged = false;

        if (value instanceof Fragment) {
            if (value.type === this._type) {
                value.setValues(this._values);
            } else {
                needsMount = true;
            }

            context.requestUpdate(value);
        } else {
            needsMount = true;
        }

        if (needsMount) {
            const newFragment = new Fragment(this._template, this._values);

            hasChanged = part.setValue(newFragment, context);

            context.requestUpdate(newFragment);
        }

        return hasChanged;
    }
}

function block(type, props = {}) {
    return new BlockDirective(type, props);
}

function list(values, keySelector = (_value, index) => index) {
    return new ListDirective(values, keySelector);
}

class Ref extends Directive {
    constructor(initialValue) {
        super();
        this.current = initialValue;
    }

    handle(part) {
        this.current = part.value;
    }
}

class HookEffect {
    constructor(setup, dependencies) {
        this.setup = setup;
        this.dependencies = dependencies;
        this.clean = null;
    }

    commit(context) {
        if (this.clean) {
            this.clean(context);
        }
        this.clean = this.setup(context);
    }
}

class RemoveItemPart {
    constructor(part) {
        this._part = part;
    }

    commit(context) {
        this._part.remove(context);
    }
}

function getUUID() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }
    const s = [...crypto.getRandomValues(new Uint8Array(16))]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' +
        s.slice(16, 20) + '-' + s.slice(20, 32);
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
                const components = child.textContent.split(HOLE_MAKER);
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
                        index: i,
                    });

                    node.insertBefore(createMaker(), child);
                    i++;
                    l++;
                }

                if (components[componentEnd] !== '') {
                    child.textContent = components[componentEnd];
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

function createMaker(name = '') {
    return document.createComment(name);
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

function updatePart(part, newValue, context) {
    if (part.setValue(newValue, context)) {
        context.enqueueMutationEffect(part);
    }
}

function cleanPart(part, context) {
    if (part.value) {
        part.value.clean(part, context);
    }
}

function boot(container, block, context = new Context()) {
    context.enqueueLayoutEffect({
        commit(_context) {
            for (const node of block.nodes) {
                container.appendChild(node);
            }
        }
    });

    context.requestUpdate(block);
}

function App(_props, context) {
    const [count, setCount] = context.useState(0);
    const [items, setItems] = context.useState(['foo', 'bar', 'baz', 'qux', 'quux']);

    context.setEnv({ 'state': 'My Env' });

    const itemsList = list(items.map((title, index, items) => block(Item, {
        title,
        onUp: context.useEvent(() => {
            if (index > 0) {
                const newItems = items.slice();
                const tmp = newItems[index];
                newItems[index] = newItems[index - 1];
                newItems[index - 1] = tmp;
                setItems(newItems);
            }
        }),
        onDown: context.useEvent(() => {
            if (index + 1 < items.length) {
                const newItems = items.slice();
                const tmp = newItems[index];
                newItems[index] = newItems[index + 1];
                newItems[index + 1] = tmp;
                setItems(newItems);
            }
        }),
        onDelete: context.useEvent(() => {
            const newItems = items.slice();
            newItems.splice(index, 1);
            setItems(newItems);
        }),
    })), (item) => item.props.title);

    const onIncrement = context.useEvent((_e) => { setCount(count + 1); });

    const onShuffle = context.useEvent((_e) => {
        const newItems = shuffle(items.slice());
        setItems(newItems);
    });

    return context.html`
        <div>
            ${block(Counter, { count })}
            ${itemsList}
            <div>
                <button type="button" onclick="${onIncrement}">+1</button>
                <button type="button" onclick="${onShuffle}">Shuffle</button>
            </div>
        </div>
    `;
}

function Item(props, context) {
    const state = context.useEnv('state');

    return context.html`
        <div>
            <span>${props.title} (${state})</span>
            <button type="button" onclick=${props.onUp}>Up</button>
            <button type="button" onclick=${props.onDown}>Down</button>
            <button type="button" onclick=${props.onDelete}>Delete</button>
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

function shuffle(array) {
    let currentIndex = array.length;

    while (currentIndex > 0) {
        const randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        const tmp = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = tmp;
    }

    return array;
}

if (typeof document === 'object') {
    boot(document.body, new Block(App, {}));
}
