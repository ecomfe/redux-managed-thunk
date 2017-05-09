/**
 * redux-managed-thunk
 *
 * @file higher order thunk creators
 * @author otakustay
 */

import {argsEqual, doAndThen, noop} from './util';
import {createDispatch, normal, ignore} from './dispatch';

const EMPTY = {};

/**
 * Creates a higher order thunk creator which will reuse previous running Promise if `shouldReuse` returns true
 *
 * This function only works with async thunks (which returns Promise)
 *
 * The default `shouldReuse` uses an algorithm which compares arguments with shallow equal
 *
 * @param {Function} [options.shouldReuse] A function receiving `(args, previousArgs)` to determine whether to reuse
 * @return {Function} A higher order thunk creator
 */
export let reusePrevious = ({shouldReuse = argsEqual} = EMPTY) => {
    let previousRunningThunk = null;
    let previousArgs = null;

    let clean = () => {
        previousRunningThunk = null;
        previousArgs = null;
    };

    return next => (...args) => (...thunkArgs) => {
        if (!previousRunningThunk || !shouldReuse(args, previousArgs)) {
            previousArgs = args;
            previousRunningThunk = next(...args)(...thunkArgs);
            previousRunningThunk.then(clean);
        }

        return previousRunningThunk;
    };
};

let collect = queue => () => action => queue.push(action);

export let transactional = () => next => (...args) => (actualDispatch, ...thunkArgs) => {
    let [dispatch, replaceBehavior] = createDispatch(actualDispatch);
    let actions = [];
    replaceBehavior(collect(actions));
    return doAndThen(
        () => next(...args)(dispatch, ...thunkArgs),
        result => {
            replaceBehavior(normal());
            actions.forEach(dispatch);
            return result;
        }
    );
};

/**
 * Creates a higher order thunk creator which will cancel previous thunk if `shouldCancel` returns true
 *
 * By "cancel" it means only to ignore all later dispatched actions, already dispatched ones are not recycled,
 * to prevent some actions dispatched before cancellation, use `transactional` together with this function
 *
 * You can also provide a `cancel` function to handle actual cancel logic,
 * this function will be invoked upon cancallation and given the running Promise instance
 *
 * This function only works with async thunks (which returns Promise)
 *
 * The default `shouldCancel` uses an algorithm which compares arguments with shallow equal
 *
 * @param {Function} [options.shouldReuse] A function receiving `(args, previousArgs)` to determine whether to reuse
 * @param {Function} [options.cancel] A function receiving `(runningPromise)` to actually cancel task
 * @return {Function} A higher order thunk creator
 */
export let cancelPrevious = ({shouldCancel = argsEqual, cancel = noop} = EMPTY) => {
    let previousRunningThunk = null;
    let previousArgs = null;
    let previousReplaceBehavior = null;

    let clean = () => {
        previousRunningThunk = null;
        previousArgs = null;
        previousReplaceBehavior = null;
    };

    return next => (...args) => (actualDispatch, ...thunkArgs) => {
        if (previousRunningThunk && shouldCancel(args, previousArgs)) {
            cancel(previousRunningThunk);
            previousReplaceBehavior(ignore());
            clean();
        }

        let [dispatch, replaceBehavior] = createDispatch(actualDispatch);
        previousArgs = args;
        previousReplaceBehavior = replaceBehavior;
        previousRunningThunk = next(...args)(dispatch, ...thunkArgs);
        previousRunningThunk.then(clean);

        return previousRunningThunk;
    };
};
