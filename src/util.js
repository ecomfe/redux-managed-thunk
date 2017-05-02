/**
 * redux-managed-thunk
 *
 * @file utility functions
 * @author otakustay
 */

import isPromise from 'is-promise';

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
 * @param {Function} next callback after job is done
 */
export let doAndThen = (job, next) => {
    let result = job();

    if (isPromise(result)) {
        result.then(next);
    }
    else {
        next(result);
    }
};
