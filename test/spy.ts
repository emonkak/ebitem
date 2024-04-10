export interface Call {
  function: Function;
  thisValue: unknown;
  args: unknown[];
  returnValue: unknown;
}

const watchings = new WeakMap<object, Call[]>();

export function spy<T extends object>(
  instance: T,
  overrides: Partial<T> = {},
): T {
  const calls: Call[] = [];
  const proxy = new Proxy(instance, {
    apply(target: T, thisValue: any, args: any[]) {
      const returnValue = Reflect.apply(target as Function, thisValue, args);
      calls.push({
        function: target as Function,
        thisValue,
        args,
        returnValue,
      });
      return returnValue;
    },
    construct(target: T, args: any[], newTarget: Function) {
      const returnValue = Reflect.construct(
        target as Function,
        args,
        newTarget,
      );
      calls.push({
        function: target as Function,
        thisValue: undefined,
        args,
        returnValue,
      });
      return returnValue;
    },
    get(target, property, receiver) {
      const value =
        overrides[property as keyof T] ??
        Reflect.get(target, property, receiver);
      if (value instanceof Function) {
        return function (this: any, ...args: any[]) {
          const returnValue = value.apply(this, args);
          calls.push({
            function: value,
            thisValue: this,
            args,
            returnValue,
          });
          return returnValue;
        };
      }
      return value;
    },
  });
  watchings.set(proxy, calls);
  return proxy;
}

export function getCalls(proxy: unknown): Readonly<Call[]> {
  return typeof proxy === 'object' && proxy !== null
    ? watchings.get(proxy) ?? []
    : [];
}

export function getLastCall(proxy: unknown): Readonly<Call> | undefined {
  return typeof proxy === 'object' && proxy !== null
    ? watchings.get(proxy)?.at(-1)
    : undefined;
}
