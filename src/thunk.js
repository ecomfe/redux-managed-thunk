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
 * @return {Function} a redux middleware function
 */
export default ({consumer = bypass()} = {}) => ({dispatch, getState}) => {
    let runThunk = thunk => {
        let [wrappedDispatch, replaceDispatch] = createDispatch(dispatch);
        let thunkResult = thunk(wrappedDispatch, getState);

        if (isPromise(thunkResult)) {
            thunkResult.then(() => replaceDispatch(error('Unable to call dispatch after async thunk resolves')));
        }
        else {
            replaceDispatch(error('Unable to call dispatch after sync thunk returns'));
        }

        return thunkResult;
    };

    let consume = consumer(runThunk);

    return next => action => {
        if (typeof action !== 'function') {
            return next(action);
        }

        return consume(action);
    };
};
