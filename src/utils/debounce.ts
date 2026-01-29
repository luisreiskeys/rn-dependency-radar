export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let handle: NodeJS.Timeout | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (this: any, ...args: any[]) {
    if (handle) {
      clearTimeout(handle);
    }
    handle = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  } as T;
}

