export interface Spy<T> {
  original: T;
  calls: Call[];
}

export interface Call {
  function: Function;
  thisValue: unknown;
  args: unknown[];
  returnValue: unknown;
}

export type SpiedObject<T> = T & {
  get [spyTag](): Spy<T>;
};

const spyTag = Symbol('Spy');

export function spy<T extends object>(original: T): SpiedObject<T> {
  const spy: Spy<T> = {
    original,
    calls: [],
  };
  const spiedObject = new Proxy(original, {
    apply(target, thisValue, args) {
      const returnValue = Reflect.apply(target as Function, thisValue, args);
      spy.calls.push({
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
      spy.calls.push({
        function: target as Function,
        thisValue: newTarget,
        args,
        returnValue,
      });
      return returnValue;
    },
    get(target, property, receiver) {
      if (property === spyTag) {
        return spy;
      }
      const value = Reflect.get(target, property, receiver);
      if (value instanceof Function) {
        return (...args: any[]) => {
          const returnValue = value.apply(target, args);
          spy.calls.push({
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
  return spiedObject as SpiedObject<T>;
}

export function getCall<T>(
  object: SpiedObject<T>,
  n: number,
): Call | undefined {
  return object[spyTag].calls.at(n);
}

export function getCalls<T>(object: SpiedObject<T>): ReadonlyArray<Call> {
  return object[spyTag].calls;
}

export function getOriginal<T>(object: SpiedObject<T>): T {
  return object[spyTag].original;
}
