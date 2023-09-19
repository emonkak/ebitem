const HOLE_UUID = getUUID();
const HOLE_MAKER = '{{' + HOLE_UUID + '}}';

const ITEM_PART_FLAG_DIRTY = 0b01;
const ITEM_PART_FLAG_REORDERED = 0b10;

const BlockStatus = {
    INITIALIZED: 1,
    UPDATED: 2,
    DIRTY: 3,
    UNMOUNTED: 4,
};

class Context {
    constructor() {
        this._currentRenderable = null;
        this._pendingMutationEffects = [];
        this._pendingLayoutEffects = [];
        this._pendingPassiveEffects = [];
        this._pendingRenderables = [];
        this._hookIndex = 0;
        this._envStack = new WeakMap();
        this._templateCaches = new WeakMap();
        this._isUpdating = false;
    }

    get currentRenderable() {
        return this._currentRenderable;
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
        const { hooks } = this._currentRenderable;
        const oldHook = hooks[this._hookIndex];
        const newHook = hooks[this._hookIndex] = new HookEffect(
            setup,
            dependencies
        );

        if (oldHook) {
            if (oldHook.shouldDispose(dependencies)) {
                this.enqueuePassiveEffect(new Dispose(oldHook));
                this.enqueuePassiveEffect(newHook);
            }
        } else {
            this.enqueuePassiveEffect(newHook);
        }

        this._hookIndex++;
    }

    useEnv(name, defaultValue = null) {
        let block = this._currentRenderable;
        while (block = block.parent) {
            const env = this._envStack.get(block);
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
        const { hooks } = this._currentRenderable;
        const oldHook = hooks[this._hookIndex];
        const newHook = hooks[this._hookIndex] = new HookEffect(
            setup,
            dependencies
        );

        if (oldHook) {
            if (oldHook.shouldDispose(dependencies)) {
                this.enqueuePassiveEffect(new Dispose(oldHook));
                this.enqueueLayoutEffect(newHook);
            }
        } else {
            this.enqueueLayoutEffect(newHook);
        }

        this._hookIndex++;
    }

    useMemo(create, dependencies) {
        const { hooks } = this._currentRenderable;
        let hook = hooks[this._hookIndex];

        if (hook) {
            if (dependencies === undefined ||
                !shallowEqual(dependencies, hook.dependencies)) {
                hook.value = create();
            }
            hook.dependencies = dependencies;
        } else {
            hook = hooks[this._hookIndex] = {
                value: create(),
                dependencies,
            };
        }

        this._hookIndex++;

        return hook.value;
    }

    useReducer(reducer, initialState) {
        const block = this._currentRenderable;
        const { hooks } = block;
        let hook = hooks[this._hookIndex];

        if (!hook) {
            hook = hooks[this._hookIndex] = {
                state: initialState,
                dispatch: (action) => {
                    hook.state = reducer(hook.state, action);
                    block.forceUpdate(this);
                },
            };
        }

        this._hookIndex++;

        return [hook.state, hook.dispatch];
    }

    useRef(initialValue) {
        const hooks = this._currentRenderable.hooks;
        let hook = hooks[this._hookIndex];

        if (!hook) {
            hook = hooks[this._hookIndex] = new Ref(initialValue);
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
        this._envStack.set(this._currentRenderable, env);
    }

    requestUpdate(renderable) {
        if (this._currentRenderable) {
            if (this._currentRenderable !== renderable) {
                this._pendingRenderables.push(renderable);
            }
        } else {
            this._pendingRenderables.push(renderable);
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

        for (let i = 0; i < this._pendingRenderables.length; i++) {
            if (navigator.scheduling.isInputPending()) {
                await yieldToMain();
            }
            this._hookIndex = 0;
            this._currentRenderable = this._pendingRenderables[i];
            this._currentRenderable.render(this);
            this._currentRenderable = null;
        }

        this._pendingRenderables.length = 0;

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

        if (this._pendingRenderables.length > 0) {
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

            mountPart(part, values[i], context);

            parts[i] = part;
        }

        return { node, parts };
    }

    patch(parts, oldValues, newValues, context) {
        for (let i = 0, l = this._holes.length; i < l; i++) {
            updatePart(parts[i], oldValues[i], newValues[i], context);
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

    setValue(newValue) {
        this._pendingValue = newValue;
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

    setValue(newValue) {
        this._pendingValue = newValue;
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
    constructor(node) {
        this._node = node;
        this._committedValue = null;
        this._pendingValue = null;
    }

    get startNode() {
        return this._committedValue ?
            this._committedValue.startNode ?? this._node :
            this._node;
    }

    get endNode() {
        return this._node;
    }

    get value() {
        return this._committedValue;
    }

    setValue(newValue) {
        if (newValue instanceof Child) {
            this._pendingValue = newValue;
        } else if (newValue === null) {
            this._pendingValue = Nothing.instance;
        } else if (this._committedValue instanceof Text) {
            this._committedValue.setValue(newValue);
        } else {
            this._pendingValue = new Text(newValue);
        }
    }

    commit(context) {
        const oldValue = this._committedValue;
        const newValue = this._pendingValue;

        if (oldValue !== newValue) {
            if (oldValue) {
                oldValue.unmount(this, context);
            }
            newValue.mount(this, context);
        }

        newValue.commit(context);

        this._committedValue = newValue;
    }

    dispose(context) {
        if (this._node.isConnected) {
            this._node.remove();
        }

        if (this._committedValue) {
            this._committedValue.unmount(this, context);
        }
    }
}

class ItemPart extends ChildPart {
    constructor(node, containerPart) {
        super(node);
        this._containerPart = containerPart;
        this._referencePart = null;
        this._flags = ITEM_PART_FLAG_REORDERED;
    }

    setValue(value) {
        super.setValue(value);
        this._flags |= ITEM_PART_FLAG_DIRTY;
    }

    setReferencePart(referencePart) {
        this._referencePart = referencePart;
        this._flags |= ITEM_PART_FLAG_REORDERED;
    }

    commit(context) {
        const isReordered = (this._flags & ITEM_PART_FLAG_REORDERED) !== 0;
        const isDirty = (this._flags & ITEM_PART_FLAG_DIRTY) !== 0;

        if (isReordered) {
            const reference = this._referencePart ?
                this._referencePart.startNode :
                this._containerPart.endNode;
            reference.parentNode.insertBefore(this._node, reference);
        }

        if (isDirty) {
            const oldValue = this._committedValue;
            const newValue = this._pendingValue;

            if (oldValue !== newValue) {
                if (oldValue) {
                    oldValue.unmount(this, context);
                }
                newValue.mount(this, context);
            } else {
                if (isReordered) {
                    newValue.mount(this, context);
                }
            }

            newValue.commit(context);

            this._committedValue = newValue;
        } else {
            if (isReordered) {
                const value = this._committedValue;
                value.mount(this, context);
            }
        }

        this._flags = 0;
    }
}

class Child {
    get startNode() {
        return null;
    }

    get endNode() {
        return null;
    }

    mount(_part, _context) {
    }

    unmount(_part, _context) {
    }

    commit(_context) {
    }
}

class Text extends Child {
    constructor(value) {
        super();
        this._value = value;
        this._node = document.createTextNode('');
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

    mount(part, _context) {
        const container = part.endNode;
        container.parentNode.insertBefore(this._node, container);
    }

    unmount(_part, _context) {
        if (this._node.isConnected) {
            this._node.remove();
        }
    }

    commit(_context) {
        this._node.textContent = this._value.toString();
    }
}

class List extends Child {
    constructor(items, valueSelector, keySelector, containerPart, context) {
        super();
        const parts = new Array(items.length);
        const values = new Array(items.length);
        const keys = new Array(items.length);
        for (let i = 0, l = items.length; i < l; i++) {
            const item = items[i];
            const part = new ItemPart(createMaker(), containerPart);
            const value = valueSelector(item, i);
            const key = keySelector(item, i);
            mountPart(part, value, context);
            parts[i] = part;
            values[i] = value;
            keys[i] = key;
        }
        this._containerPart = containerPart;
        this._commitedParts = [];
        this._commitedValues = [];
        this._commitedKeys = [];
        this._pendingParts = parts;
        this._pendingValues = values;
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

    setItems(newItems, valueSelector, keySelector, context) {
        const oldParts = this._commitedParts;
        const oldValues = this._commitedValues;
        const oldKeys = this._commitedKeys;
        const newParts = new Array(newItems.length);
        const newValues = newItems.map(valueSelector);
        const newKeys = newItems.map(keySelector);

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
                updatePart(
                    part,
                    oldValues[oldHead],
                    newValues[newHead],
                    context
                );
                newParts[newHead] = part;
                oldHead++;
                newHead++;
            } else if (oldKeys[oldTail] === newKeys[newTail]) {
                // Old tail matches new tail; update in place
                const part = oldParts[oldTail];
                updatePart(
                    part,
                    oldValues[oldTail],
                    newValues[newTail],
                    context
                );
                newParts[newTail] = part;
                oldTail--;
                newTail--;
            } else if (oldKeys[oldHead] === newKeys[newTail]) {
                // Old tail matches new head; update and move to new head
                const part = oldParts[oldHead];
                updateAndReorderPart(
                    part,
                    newParts[newTail + 1] ?? null,
                    oldValues[oldHead],
                    newValues[newTail],
                    context
                );
                newParts[newTail] = part;
                oldHead++;
                newTail--;
            } else if (oldKeys[oldTail] === newKeys[newHead]) {
                // Old tail matches new head; update and move to new head
                const part = oldParts[oldTail];
                updateAndReorderPart(
                    part,
                    oldParts[oldHead],
                    oldValues[oldTail],
                    newValues[newHead],
                    context
                );
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
                    context.enqueueMutationEffect(new Dispose(part));
                    oldHead++;
                } else if (!newKeyToIndexMap.has(oldKeys[oldTail])) {
                    // Old tail is no longer in new list; remove
                    const part = oldParts[oldTail];
                    context.enqueueMutationEffect(new Dispose(part));
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
                            this._containerPart
                        );
                        mountPart(
                            part,
                            newValues[newHead],
                            context
                        );
                        newParts[newHead] = part;
                    } else {
                        // Reuse old part
                        newParts[newHead] = oldPart;
                        updateAndReorderPart(
                            oldPart,
                            oldParts[oldHead],
                            oldValues[oldHead],
                            newValues[newHead],
                            context
                        );
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
            const newPart = new ItemPart(createMaker(), this._containerPart);
            mountPart(newPart, newValues[newHead], context);
            newParts[newHead++] = newPart;
        }

        // Remove any remaining unused old parts
        while (oldHead <= oldTail) {
            const oldPart = oldParts[oldHead++];
            if (oldPart !== null) {
                context.enqueueMutationEffect(new Dispose(oldPart));
            }
        }

        this._pendingParts = newParts;
        this._pendingValues = newValues;
        this._pendingKeys = newKeys;
    }

    mount(_part, _context) {
    }

    unmount(_part, context) {
        for (const part of this._commitedParts) {
            part.dispose(context);
        }
    }

    commit(_context) {
        this._commitedParts = this._pendingParts;
        this._commitedValues = this._pendingValues;
        this._commitedKeys = this._pendingKeys;
    }
}

class Fragment extends Child {
    constructor(template, values) {
        super();
        this._template = template;
        this._pendingValues = values;
        this._memoizedValues = null;
        this._nodes = [];
        this._parts = [];
        this._isMounted = false;
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

    mount(part, _context) {
        const reference = part.endNode;
        const parent = reference.parentNode;
        for (const node of this._nodes) {
            parent.insertBefore(node, reference);
        }
    }

    unmount(_part, context) {
        for (const node of this._nodes) {
            if (node.isConnected) {
                node.remove();
            }
        }
        for (const part of this._parts) {
            if (part instanceof ChildPart) {
                part.dispose(context);
            }
        }
    }

    render(context) {
        if (!this._memoizedValues) {
            const { node, parts } = this._template.mount(
                this._pendingValues,
                context
            );
            this._nodes = [...node.childNodes];
            this._parts = parts;
        } else {
            this._template.patch(
                this._parts,
                this._memoizedValues,
                this._pendingValues,
                context
            );
        }
        this._memoizedValues = this._pendingValues;
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

    forceUpdate(context) {
        if (this._status === BlockStatus.UPDATED) {
            this._status = BlockStatus.DIRTY;
            context.requestUpdate(this);
        }
    }

    render(context) {
        if (this._status === BlockStatus.INITIALIZED) {
            const render = this._type;
            const { template, values } = render(this._pendingProps, context);
            const { node, parts } = template.mount(values, context);
            this._memoizedProps = this._pendingProps;
            this._nodes = [...node.childNodes];
            this._parts = parts;
            this._status = BlockStatus.UPDATED;
            this._values = values;
        } else if (this._status === BlockStatus.DIRTY) {
            const render = this._type;
            const { template, values } = render(this._pendingProps, context);
            template.patch(this._parts, this._values, values, context)
            this._memoizedProps = this._pendingProps;
            this._status = BlockStatus.UPDATED;
            this._values = values;
        }
    }

    mount(part, _context) {
        const reference = part.endNode;
        const parent = reference.parentNode;

        for (const node of this._nodes) {
            parent.insertBefore(node, reference);
        }
    }

    unmount(_part, context) {
        for (const node of this._nodes) {
            if (node.isConnected) {
                node.remove();
            }
        }
        for (let i = 0, l = this._hooks.length; i < l; i++) {
            const hook = this._hooks[i];
            if (hook instanceof HookEffect) {
                hook.dispose(context);
            }
        }
        for (let i = 0, l = this._parts.length; i < l; i++) {
            const part = this._parts[i];
            if (part instanceof ChildPart) {
                part.dispose(context);
            }
        }
        this._status = BlockStatus.UNMOUNTED;
    }
}

class Nothing extends Child {
    static instance = new Nothing();
}

class Directive {
    handle(_part, _context) {
        return false;
    }
}

class Ref extends Directive {
    constructor(initialValue) {
        super();
        this.current = initialValue;
    }

    handle(part) {
        this.current = part.value;
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

        if (value instanceof Block) {
            if (value.type === this._type) {
                value.setProps(this._props);
                value.forceUpdate(context);
            } else {
                context.enqueuePassiveEffect(new Dispose(value))
                needsMount = true;
            }
        } else {
            needsMount = true;
        }

        if (needsMount) {
            const newBlock = new Block(
                this._type,
                this._props,
                context.currentRenderable
            );
            part.setValue(newBlock);
            context.requestUpdate(newBlock);
        }

        return needsMount;
    }
}

class ListDirective extends Directive {
    constructor(items, valueSelector, keySelector) {
        super();
        this._items = items;
        this._valueSelector = valueSelector;
        this._keySelector = keySelector;
    }

    handle(part, context) {
        const value = part.value;

        if (value instanceof List) {
            value.setItems(
                this._items,
                this._valueSelector,
                this._keySelector,
                context
            );
        } else {
            const list = new List(
                this._items,
                this._valueSelector,
                this._keySelector,
                part,
                context
            );
            part.setValue(list, context);
        }

        return true;
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

        if (value instanceof Fragment) {
            if (value.type === this._type) {
                value.setValues(this._values);
                context.requestUpdate(value);
            } else {
                context.enqueuePassiveEffect(new Dispose(value))
                needsMount = true;
            }
        } else {
            needsMount = true;
        }

        if (needsMount) {
            const newFragment = new Fragment(this._template, this._values);
            part.setValue(newFragment, context);
            context.requestUpdate(newFragment);
        }

        return needsMount;
    }
}

function block(type, props = {}) {
    return new BlockDirective(type, props);
}

function list(items, valueSelector = defaultItemValueSelector, keySelector = defaultItemKeySelector) {
    return new ListDirective(items, valueSelector, keySelector);
}

class HookEffect {
    constructor(setup, dependencies) {
        this._setup = setup;
        this._dependencies = dependencies;
        this._clean = null;
    }

    shouldDispose(dependencies) {
        return dependencies === undefined ||
            !shallowEqual(dependencies, this._dependencies);
    }

    commit(context) {
        this._clean = this._setup(context);
    }

    dispose(context) {
        if (this._clean) {
            this._clean(context);
            this._clean = null;
        }
    }
}

class Dispose {
    constructor(disposable) {
        this._disposable = disposable;
    }

    commit(context) {
        this._disposable.dispose(context);
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

function mountPart(part, value, context) {
    if (value instanceof Directive) {
        if (value.handle(part, context)) {
            context.enqueueMutationEffect(part);
        }
    } else {
        part.setValue(value);
        context.enqueueMutationEffect(part);
    }
}

function updatePart(part, oldValue, newValue, context) {
    if (!Object.is(oldValue, newValue)) {
        if (newValue instanceof Directive) {
            if (newValue.handle(part, context)) {
                context.enqueueMutationEffect(part);
            }
        } else {
            part.setValue(newValue);
            context.enqueueMutationEffect(part);
        }
    }
}

function updateAndReorderPart(part, referencePart, oldValue, newValue, context) {
    if (!Object.is(oldValue, newValue)) {
        if (newValue instanceof Directive) {
            newValue.handle(part, context);
        } else {
            part.setValue(newValue);
        }
    }
    part.setReferencePart(referencePart);
    context.enqueueMutationEffect(part);
}

function defaultItemValueSelector(value, _index) {
    return value;
}

function defaultItemKeySelector(_value, index) {
    return index;
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

    const itemsList = list(
        items,
        (item, index) => block(Item, {
            title: item,
            onUp: () => {
                if (index > 0) {
                    const newItems = items.slice();
                    const tmp = newItems[index];
                    newItems[index] = newItems[index - 1];
                    newItems[index - 1] = tmp;
                    setItems(newItems);
                }
            },
            onDown: () => {
                if (index + 1 < items.length) {
                    const newItems = items.slice();
                    const tmp = newItems[index];
                    newItems[index] = newItems[index + 1];
                    newItems[index + 1] = tmp;
                    setItems(newItems);
                }
            },
            onDelete: () => {
                const newItems = items.slice();
                newItems.splice(index, 1);
                setItems(newItems);
            },
        }),
        (item) => item,
    );

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
                <button type="button" onclick=${onIncrement}>+1</button>
                <button type="button" onclick=${onShuffle}>Shuffle</button>
            </div>
        </div>
    `;
}

function Item(props, context) {
    const state = context.useEnv('state');

    return context.html`
        <div>
            <span>${props.title} (${state})</span>
            <button type="button" onclick=${context.useEvent(props.onUp)}>Up</button>
            <button type="button" onclick=${context.useEvent(props.onDown)}>Down</button>
            <button type="button" onclick=${context.useEvent(props.onDelete)}>Delete</button>
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
