import {expect} from 'chai';
import sinon from 'sinon';
import {reusePrevious, transactional, cancelPrevious} from '../src/index';

describe('built-in higher order thunk creators', () => {
    describe('reusePrevious', () => {
        it('should reuse previous running thunk if inputs are equal', async () => {
            let calls = [];
            let creator = (x, y) => (a, b, c) => {
                calls.push([x, y, a, b, c]);
                return Promise.resolve(x + y + a + b + c);
            };
            let wrapped = reusePrevious()(creator);
            let firstCall = wrapped(1, 2)(3, 4, 5);
            let secondCall = wrapped(1, 2)(3, 4, 5);
            expect(calls.length).to.equal(1);
            expect(calls[0]).to.deep.equal([1, 2, 3, 4, 5]);
            expect(firstCall).to.equal(secondCall);
            let firstSum = await firstCall;
            expect(firstSum).to.equal(15);
            let secondSum = await secondCall;
            expect(secondSum).to.equal(15);
        });

        it('should not reuse previous if inputs are not equal', async () => {
            let calls = [];
            let creator = (...stumps) => (a, b, c) => {
                calls.push([...stumps, a, b, c]);
                return Promise.resolve(stumps.reduce((sum, i) => sum + i) + a + b + c);
            };
            let wrapped = reusePrevious()(creator);
            let firstCall = wrapped(1, 2)(3, 4, 5);
            let secondCall = wrapped(2, 3, 4)(3, 4, 5);
            expect(calls.length).to.equal(2);
            expect(calls[0]).to.deep.equal([1, 2, 3, 4, 5]);
            expect(calls[1]).to.deep.equal([2, 3, 4, 3, 4, 5]);
            expect(firstCall).to.not.equal(secondCall);
            let firstSum = await firstCall;
            let secondSum = await secondCall;
            expect(firstSum).to.equal(15);
            expect(secondSum).to.equal(21);
        });

        it('should only reuse the most recent call', async () => {
            let calls = [];
            let creator = (x, y) => (a, b, c) => {
                calls.push([x, y, a, b, c]);
                return Promise.resolve(x + y + a + b + c);
            };
            let wrapped = reusePrevious()(creator);
            let firstCall = wrapped(1, 2)(3, 4, 5);
            let secondCall = wrapped(3, 4)(3, 4, 5);
            let thirdCall = wrapped(1, 2)(3, 4, 5);
            expect(calls.length).to.equal(3);
            expect(calls[0]).to.deep.equal([1, 2, 3, 4, 5]);
            expect(calls[1]).to.deep.equal([3, 4, 3, 4, 5]);
            expect(calls[2]).to.deep.equal([1, 2, 3, 4, 5]);
            expect(firstCall).to.not.equal(secondCall);
            let firstSum = await firstCall;
            expect(firstSum).to.equal(15);
            let secondSum = await secondCall;
            expect(secondSum).to.equal(19);
        });
    });

    describe('transactional', () => {
        it('should collect all actions during thunk execution and dispatch them when thunk finishes', async () => {
            let dispatch = sinon.spy();
            let creator = () => dispatch => {
                dispatch(1);
                return Promise.resolve().then(() => dispatch(2));
            };
            let wrapped = transactional()(creator);
            let call = wrapped()(dispatch);
            expect(dispatch.called).to.equal(false);
            await call;
            expect(dispatch.called).to.equal(true);
            expect(dispatch.callCount).to.equal(2);
            expect(dispatch.firstCall.args).to.deep.equal([1]);
            expect(dispatch.secondCall.args).to.deep.equal([2]);
        });

        it('should work with sync thunk', () => {
            let dispatch = sinon.spy();
            let creator = () => dispatch => {
                dispatch(1);
                throw new Error();
            };
            let wrapped = transactional()(creator);
            try {
                wrapped()(dispatch);
            }
            catch (ex) {
            }
            expect(dispatch.called).to.equal(false);
        });
    });

    describe('cancelPrevious', () => {
        it('should ignore later dispatched actions when second identical thunk starts', async () => {
            let dispatch = sinon.spy();
            let creator = (x, y) => dispatch => {
                dispatch(1);
                return Promise.resolve().then(() => dispatch(2));
            };
            let wrapped = cancelPrevious()(creator);
            await Promise.all([wrapped(1, 2)(dispatch), wrapped(1, 2)(dispatch)]);
            expect(dispatch.called).to.equal(true);
            expect(dispatch.callCount).to.equal(3);
            expect(dispatch.firstCall.args).to.deep.equal([1]);
            expect(dispatch.secondCall.args).to.deep.equal([1]);
            expect(dispatch.thirdCall.args).to.deep.equal([2]);
        });

        it('should invoke custom cancel function with running promise', () => {
            let dispatch = sinon.spy();
            let creator = (x, y) => dispatch => {
                dispatch(1);
                return Promise.resolve().then(() => dispatch(2));
            };
            let cancel = sinon.spy();
            let wrapped = cancelPrevious({cancel})(creator);
            let firstCall = wrapped(1, 2)(dispatch);
            wrapped(1, 2)(dispatch);
            expect(cancel.called).to.equal(true);
            expect(cancel.firstCall.args).to.deep.equal([firstCall]);
        });
    })
});
