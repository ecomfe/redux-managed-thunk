/**
 * redux-managed-thunk
 *
 * @file optimistic action
 * @author otakustay
 */

import {applyMiddleware, compose} from 'redux';
import isPromise from 'is-promise';
import {createOptimisticManager, createOptimisticReducer} from 'redux-optimistic-manager';
import {isArray} from './util';
import managedThunk from './thunk';

let isOptimisticAction = action => (
    isArray(action)
    && action.length === 2
    && typeof action[0] === 'function'
    && typeof action[1] === 'function'
);

let uid = (() => {
    let counter = 0;
    return () => ++counter;
})();

/**
 * Creates the managed thunk middleware
 *
 * @param {Object} [options] options
 * @param {Function} [options.consumer] a custom consumer function to handle all thunks
 * @param {boolean} [options.loose = false] when set to `true`, `dispatch` will still be usable after thunk finishes
 * @return {Function} a redux middleware function
 */
let optimisticThunk = store => {
    let {postAction, rollback} = createOptimisticManager(store);

    let withTransaction = (thunk, transactionId) => (dispatch, ...args) => {
        let dispatchWithPost = action => dispatch(postAction(action, transactionId));
        return thunk(dispatchWithPost, ...args);
    };

    return next => action => {
        if (!isOptimisticAction(action)) {
            return next(action);
        }

        let [actualThunk, optimisticThunk] = action;
        // transactionId can be any object, but here we use a number for debugging support
        let transactionId = uid();

        let isActualThunkReturned = false;
        let isRollbackCompleted = false;
        let thunkWithRollback = (dispatch, ...args) => {
            let dispatchWithRollback = action => {
                if (isActualThunkReturned && !isRollbackCompleted) {
                    rollback(transactionId);
                    isRollbackCompleted = true;
                }

                return dispatch(action);
            };
            return actualThunk(dispatchWithRollback, ...args);
        };

        let actualThunkRunning = next(withTransaction(thunkWithRollback, null));

        if (!isPromise(actualThunkRunning)) {
            throw new Error('Actual thunk of optimistic action must be async');
        }

        isActualThunkReturned = true;

        let optimisticThunkReturn = next(withTransaction(optimisticThunk, transactionId));

        if (isPromise(optimisticThunkReturn)) {
            throw new Error('Optimistic thunk of optimistic action must be sync');
        }

        return actualThunkRunning;
    };
};

let optimisticReducer = next => (nextReducer, preloadedState) => {
    let reducer = createOptimisticReducer(nextReducer);
    return next(reducer, preloadedState);
};

export default options => compose(
    applyMiddleware(optimisticThunk, managedThunk(options)),
    optimisticReducer
);
