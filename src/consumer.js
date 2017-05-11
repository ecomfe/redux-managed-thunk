/**
 * redux-managed-thunk
 *
 * @file built-in consumer functions
 * @author otakustay
 */

import {partial, doAndThen} from './util';

/**
 * Simply push all incoming thunks to next consumer, this is the default consumer implement
 *
 * @return {Function} a consumer function
 */
export let bypass = () => run => thunk => run(thunk);

/**
 * Allows a max of `limit` thunks running at a time, others must be queued
 *
 * @param {number} limit the max parallelism limit
 * @return {Function} a consumer function
 */
export let cocurrency = limit => run => {
    let pendings = [];
    let currentlyRunningThunks = 0;

    let takeNext = () => {
        if (pendings.length) {
            let {thunk, resolve, reject} = pendings.shift();
            doAndThen(
                partial(run, thunk),
                result => {
                    resolve(result);
                    takeNext();
                },
                error => {
                    reject(error);
                    takeNext();
                }
            );
        }
        else {
            currentlyRunningThunks--;
        }
    };

    return thunk => {
        let executor = (resolve, reject) => {
            pendings.push({thunk, resolve, reject});

            if (currentlyRunningThunks < limit) {
                currentlyRunningThunks++;
                takeNext();
            }
        };
        return new Promise(executor);
    };
};

/**
 * Allows one thunk running at a time, queue all other thunks
 *
 * @return {Function} a consumer function
 */
export let series = () => cocurrency(1);

/**
 * Provides extra arguments to thunk (after `dispatch` and `getState`)
 *
 * @param {...*} extraArguments provided extra arguments to thunk
 * @return {Function} a consumer function
 */
export let inject = (...extraArguments) => run => thunk => {
    let withInjection = (...args) => thunk(...args, ...extraArguments);
    return run(withInjection);
};

/**
 * Provides extra arguments to thunk (after `dispatch` and `getState`) returned from factory functions
 *
 * @param {...*} factories factory functions which return extra arguments to thunk
 * @return {Function} a consumer function
 */
export let injectWith = (...factories) => run => thunk => {
    let withInjection = (...args) => thunk(...args, ...factories.map(fn => fn()));
    return run(withInjection);
};

/**
 * Reduce multiple consumers into one
 *
 * @param {...Function} consumers consumers to reduce
 * @return {Function} a consumer function with all input consumers merged from left to right
 */
export let reduceConsumers = (...consumers) => run => consumers.reduceRight((result, current) => current(result), run);
