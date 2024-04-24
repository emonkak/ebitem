export interface Call {
  function: Function;
  thisValue: unknown;
  args: unknown[];
  returnValue: unknown;
}

export interface Watch {
  original: object;
  calls: Call[];
}

const watches = new WeakMap<object, Watch>();

export function spy<T extends object>(original: T): T {
  const watch: Watch = {
    original,
    calls: [],
  };
  const proxy = new Proxy(original, {
    apply(target, thisValue, args) {
      const returnValue = Reflect.apply(target as Function, thisValue, args);
      watch.calls.push({
        function: target as Function,
        thisValue,
        args,
        returnValue,
      });
      return returnValue;
    },
    construct(target, args, newTarget) {
      const returnValue = Reflect.construct(
        target as Function,
        args,
        newTarget,
      );
      watch.calls.push({
        function: target as Function,
        thisValue: newTarget,
        args,
        returnValue,
      });
      return returnValue;
    },
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (value instanceof Function) {
        return (...args: any[]) => {
          const returnValue = value.apply(target, args);
          watch.calls.push({
            function: value,
            thisValue: target,
            args,
            returnValue,
          });
          return returnValue;
        };
      }
      return value;
    },
  });
  watches.set(proxy, watch);
  return proxy;
}

export function getCall(value: unknown, n: number): Call | undefined {
  return isObject(value) ? watches.get(value)?.calls.at(n) : undefined;
}

export function getCalls(value: unknown): ReadonlyArray<Call> {
  return isObject(value) ? watches.get(value)?.calls ?? [] : [];
}

export function getOriginal<T>(value: T): T | undefined {
  return isObject(value)
    ? (watches.get(value)?.original as T | undefined)
    : undefined;
}

function isObject(value: unknown): value is object {
  return (
    (typeof value === 'object' && value !== null) || typeof value === 'function'
  );
}
