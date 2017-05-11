/**
 * redux-managed-thunk
 *
 * @file utility functions
 * @author otakustay
 */

import isPromise from 'is-promise';

/**
 * Empty function
 */
export let noop = () => {};

/**
 * Partially apply function with one fixed argument, only accept one argument
 *
 * @param {Function} fn function to apply
 * @param {*} arg fixed argument
 * @return {Function} partially applied function
 */
export let partial = (fn, arg) => () => fn(arg);

/**
 * Execute a either sync or async job and then run callback with returned value,
 * if job is synchronous then callback will be invoked synchronously
 *
 * @param {Function} job job to execute
 * @param {Function} next callback after job returns or resolves
 * @param {Function} error callback after job throws or rejects
 */
export let doAndThen = (job, next, error) => {
    try {
        let result = job();

        if (isPromise(result)) {
            return result.then(next, error);
        }

        return next(result);
    }
    catch (ex) {
        return error(ex);
    }
};

let toString = Object.prototype.toString;

export let isArray = value => toString.call(value) === '[object Array]';

// Forked from [react-redux](https://github.com/reactjs/react-redux/blob/master/src/utils/shallowEqual.js)
/* istanbul ignore next */
let hasOwn = Object.prototype.hasOwnProperty;

/* eslint-disable fecs-arrow-body-style */
let is = (() => {
    /* istanbul ignore next */
    return (x, y) => {
        if (x === y) {
            return x !== 0 || y !== 0 || 1 / x === 1 / y;
        }

        /* eslint-disable no-self-compare */
        return x !== x && y !== y;
        /* eslint-enable no-self-compare */
    };
})();

let shallowEqual = (() => {
    /* istanbul ignore next */
    return (objA, objB) => {
        if (is(objA, objB)) {
            return true;
        }

        if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
            return false;
        }

        let keysA = Object.keys(objA);
        let keysB = Object.keys(objB);

        if (keysA.length !== keysB.length) {
            return false;
        }

        for (let i = 0; i < keysA.length; i++) {
            if (!hasOwn.call(objB, keysA[i]) || !is(objA[keysA[i]], objB[keysA[i]])) {
                return false;
            }
        }

        return true;
    };
})();
/* eslint-enable fecs-arrow-body-style */

export let argsEqual = (x, y) => {
    // `args` are arrays and are never reference equal
    if (x.length !== y.length) {
        return false;
    }

    for (let i = 0; i < x.length; i++) {
        if (!shallowEqual(x[i], y[i])) {
            return false;
        }
    }

    return true;
};
