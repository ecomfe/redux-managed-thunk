import {expect} from 'chai';
import sinon from 'sinon';
import {createStore} from 'redux';
import {optimisticEnhancer} from '../src/index';

describe('optimisticEnhancer', () => {
    it('should be a function', () => {
        expect(typeof optimisticEnhancer).to.equal('function');
    });

    it('should work as a store enhancer', () => {
        let store = createStore(() => {}, null, optimisticEnhancer());
        expect(typeof store).to.equal('object');
        expect(typeof store.dispatch).to.equal('function');
        expect(typeof store.getState).to.equal('function');
        expect(typeof store.subscribe).to.equal('function');
        expect(typeof store.replaceReducer).to.equal('function');
    });

    it('should add optimistic property to state', () => {
        let {dispatch, getState} = createStore(i => (i ? i : {}), null, optimisticEnhancer());
        dispatch({type: 'TEST'});
        expect(getState()).to.deep.equal({optimistic: false});
    });

    it('should consume optimistic action', () => {
        let actual = sinon.spy(() => Promise.resolve());
        let optimistic = sinon.spy();
        let {dispatch, getState} = createStore(i => (i ? i : {}), null, optimisticEnhancer());
        dispatch([actual, optimistic]);
        expect(actual.called).to.equal(true);
        expect(typeof actual.firstCall.args[0]).to.equal('function');
        expect(typeof actual.firstCall.args[1]).to.equal('function');
        expect(optimistic.called).to.equal(true);
        expect(typeof optimistic.firstCall.args[0]).to.equal('function');
        expect(typeof optimistic.firstCall.args[1]).to.equal('function');
    });

    it('should throw if actual thunk is sync', () => {
        let {dispatch, getState} = createStore(i => (i ? i : {}), null, optimisticEnhancer());
        expect(() => dispatch([() => {}, () => {}])).to.throw();
    });

    it('should throw if optimistic thunk is async', () => {
        let {dispatch, getState} = createStore(i => (i ? i : {}), null, optimisticEnhancer());
        expect(() => dispatch([() => Promise.resolve(), () => Promise.resolve()])).to.throw();
    });

    it('should rollback actions dispatched from optimistic thunk after actual thunk resolves', async () => {
        let reducer = (state, action) => {
            if (action.type === 'PUSH') {
                console.log('receive', action);
                return {...state, values: state.values.concat(action.payload)}
            };
            return state;
        };

        let {dispatch, getState} = createStore(reducer, {values: []}, optimisticEnhancer());
        let running = dispatch([
            dispatch => {
                dispatch({type: 'PUSH', payload: 1});
                return Promise.resolve().then(() => dispatch({type: 'PUSH', payload: 4}));
            },

            dispatch => {
                dispatch({type: 'PUSH', payload: 2});
                dispatch({type: 'PUSH', payload: 3});
            }
        ]);
        expect(getState()).to.deep.equal({optimistic: true, values: [1, 2, 3]});
        await running;
        expect(getState()).to.deep.equal({optimistic: false, values: [1, 4]});
    });

    it('should consume simple thunks', done => {
        let {dispatch, getState} = createStore(i => (i ? i : {}), null, optimisticEnhancer());
        let normalThunk = sinon.spy();
        dispatch(normalThunk);
        expect(normalThunk.called).to.equal(true);
        expect(typeof normalThunk.firstCall.args[0]).to.equal('function');
        expect(typeof normalThunk.firstCall.args[1]).to.equal('function');

        let errorThunk = dispatch => {
            setImmediate(() => {
                expect(() => dispatch({type: 'TEST'})).to.throw();
                done()
            });
        };
        dispatch(errorThunk);
    });

    it('should replay actions out of thunks', async () => {
        let reducer = (state, action) => {
            if (action.type === 'PUSH') {
                return {...state, values: state.values.concat(action.payload)}
            };
            return state;
        };

        let {dispatch, getState} = createStore(reducer, {values: []}, optimisticEnhancer());
        let running = dispatch([
            dispatch => {
                dispatch({type: 'PUSH', payload: 1});
                return Promise.resolve().then(() => dispatch({type: 'PUSH', payload: 4}));
            },

            dispatch => {
                dispatch({type: 'PUSH', payload: 2});
                dispatch({type: 'PUSH', payload: 3});
            }
        ]);
        dispatch({type: 'PUSH', payload: 5});
        await running;
        expect(getState()).to.deep.equal({optimistic: false, values: [1, 5, 4]});
    });

    it('should pass options to managedThunk', () => {
        // use `loose` to test options bypass
        let {dispatch, getState} = createStore(i => (i ? i : {}), null, optimisticEnhancer({loose: true}));
        let errorThunk = dispatch => {
            setImmediate(() => {
                expect(() => dispatch({type: 'TEST'})).not.to.throw();
                done()
            });
        };
        dispatch(errorThunk);
    });
});
