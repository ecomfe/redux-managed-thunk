import {expect} from 'chai';
import managedThunk from '../src/index';

let createStore = () => {
    let actions = [];

    return {
        actions: actions,

        dispatch(action) {
            actions.push(action);
        },

        getState() {
        }
    };
};

let applyThunk = options => {
    let store = createStore();
    let dispatch = managedThunk(options)(store)(store.dispatch);
    return {store, dispatch};
};

describe('managedThunk', () => {
    it('should be a function', () => {
        expect(typeof managedThunk).to.equal('function');
    });

    it('should return a middleware function', () => {
        expect(typeof managedThunk()).to.equal('function');
    });

    it('should invoke function type action given native dispatch as argument', () => {
        let {store, dispatch} = applyThunk();
        dispatch(dispatch => dispatch({type: 'TEST'}));
        expect(store.actions[0]).to.deep.equal({type: 'TEST'});
    });

    it('should bypass non function action', () => {
        let {store, dispatch} = applyThunk();
        dispatch({type: 'TEST'});
        expect(store.actions[0]).to.deep.equal({type: 'TEST'});
    });

    it('should throw error when call dispatch after sync thunk returns', done => {
        let {store, dispatch} = applyThunk();
        dispatch(dispatch => {
            setImmediate(() => {
                expect(() => dispatch({type: 'TEST'})).to.throw()
                done();
            });
        });
    });

    it('should throw error when call dispatch after async thunk resolves', done => {
        let {store, dispatch} = applyThunk();
        dispatch(async dispatch => {
            setImmediate(() => {
                expect(() => dispatch({type: 'TEST'})).to.throw()
                done();
            });
        });
    });

    it('should work with custom consumer function', () => {
        let pendings = [];
        let consumer = run => thunk => {
            pendings.push(thunk);
            if (pendings.length === 2) {
                run(dispatch => {
                    pendings.forEach(thunk => thunk(dispatch));
                    dispatch({type: 'CONSUMER'});
                });
            }
        };
        let {store, dispatch} = applyThunk({consumer});
        dispatch(dispatch => dispatch({type: 'TEST1'}));
        expect(store.actions).to.deep.equal([]);
        dispatch(dispatch => dispatch({type: 'TEST2'}));
        expect(store.actions).to.deep.equal([{type: 'TEST1'}, {type: 'TEST2'}, {type: 'CONSUMER'}]);
    });
});
