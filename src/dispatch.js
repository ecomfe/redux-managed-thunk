/**
 * redux-managed-thunk
 *
 * @file stateful and replaceable dispatch function
 * @author otakustay
 */

/**
 * Create a dispatch which simply throws an error with given message
 *
 * @param {string} message error message
 * @return {Function} a dispatch function
 */
export let error = message => (/* dispatch */) => action => {
    let error = new Error(message);
    error.dispatchingAction = action;
    throw error;
};

/**
 * Create a dispatch function which simply ignore all incoming actions
 *
 * @return {Function} a dispatch function
 */
export let ignore = () => (/* dispatch */) => (/* action */) => {};

/**
 * Create a dispatch function which dispatch action as default behavior
 *
 * @return {Function} a dispatch function
 */
export let normal = () => dispatch => action => dispatch(action);

/**
 * Create a dispatch function whose behavior(implement) can be changed dynamically
 *
 * This function returns a tuple with 2 elements:
 *
 * 1. The `dispatch` function
 * 2. A `replaceBehavior` function used to replace the internal behavior of dispatch
 *
 * The `dispatch` function returned by this function is simply a wrapper of its behavior,
 * the default behavior is `normal` which dispatch incoming actions immediately,
 * you can call `replaceBehavior` function and provide a new behavior(dispatch function) to change it
 *
 * Here is an example to set dispatch behavior throwing errors:
 *
 * ```javascript
 * let [dispatch, replaceBehavior] = createDispatch(actualDispatch);
 * replaceBehavior(error('This is an error'));
 * dispatch(action); // Throws error
 * ```
 *
 * @param {Function} actualDispatch actual function to call when wrapped dispatch decied an action should be dispatched
 * @return {[Function, Function]} a tuple of [dispatch, replaceBehavior]
 */
export let createDispatch = actualDispatch => {
    let currentBehavior = normal()(actualDispatch);

    return [
        action => currentBehavior(action),
        nextBehavior => currentBehavior = nextBehavior(actualDispatch)
    ];
};
