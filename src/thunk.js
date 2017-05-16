/**
 * redux-managed-thunk
 *
 * @file thunk middle ware
 * @author otakustay
 */

import isPromise from 'is-promise';
import {createDispatch, error} from './dispatch';
import {bypass} from './consumer';

/**
 * Creates the managed thunk middleware
 *
 * @param {Object} [options] options
 * @param {Function} [options.consumer] a custom consumer function to handle all thunks
 * @param {boolean} [options.loose = false] when set to `true`, `dispatch` will still be usable after thunk finishes
 * @return {Function} a redux middleware function
 */
export default ({consumer = bypass(), loose = false} = {}) => ({dispatch, getState}) => next => {

    let runThunk = loose
        ? thunk => thunk(next, getState)
        : thunk => {
            let [wrappedDispatch, replaceBehavior] = createDispatch(next);
            let thunkResult = thunk(wrappedDispatch, getState);

            if (isPromise(thunkResult)) {
                thunkResult.then(() => replaceBehavior(error('Unable to call dispatch after async thunk resolves')));
            }
            else {
                replaceBehavior(error('Unable to call dispatch after sync thunk returns'));
            }

            return thunkResult;
        };

    let consume = consumer(runThunk);

    return action => {
        if (typeof action !== 'function') {
            return next(action);
        }

        return consume(action);
    };
};
