"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debounce = debounce;
function debounce(fn, delay) {
    let handle;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function (...args) {
        if (handle) {
            clearTimeout(handle);
        }
        handle = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}
//# sourceMappingURL=debounce.js.map