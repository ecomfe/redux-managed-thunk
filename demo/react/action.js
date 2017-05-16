/**
 * redux-optimistic-thunk
 *
 * @file react example
 * @author otakustay
 */

export let newItem = item => ({type: 'NEW_ITEM', item: item});

export let saveItem = text => [
    async (dispatch, getState, {uid, delay}) => {
        await delay(getState().delay);

        dispatch(newItem({text: text, id: uid(), pending: false, deleted: false}));
    },
    (dispatch, getState, {uid}) => dispatch(newItem({text: text, id: uid(), pending: true, deleted: false}))
];

export let deleteItem = id => ({type: 'DELETE_ITEM', id: id});

export let setDelay = delay => ({type: 'SET_DELAY', delay: delay});
