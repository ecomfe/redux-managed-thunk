import sinon from 'sinon';
import {expect} from 'chai';
import {bypass, series, inject, injectWith, reduceConsumers} from '../src/index';

let dispatch = () => {};
let getState = () => {};
let run = thunk => thunk(dispatch, getState);

describe('consumer functions', () => {
    describe('bypass', () => {
        let consume = bypass()(run);

        it('should call thunk immediately', () => {
            let first = sinon.spy();
            let second = sinon.spy();
            consume(first);
            expect(first.called).to.equal(true);
            consume(second);
            expect(second.called).to.equal(true);
        });

        it('should not waiting for async thunk', () => {
            let first = sinon.spy(Promise.resolve.bind(Promise));
            let second = sinon.spy();
            consume(first);
            expect(first.called).to.equal(true);
            consume(second);
            expect(second.called).to.equal(true);
        });
    });

    describe('series', () => {
        let consume = series()(run);

        it('should call thunk one by one and wait for async thunk to complete', done => {
            let second = sinon.spy();
            let asyncThunk = () => {
                let promise = Promise.resolve();
                promise.then(() => expect(second.called).to.equal(false));
                return promise.then(done);
            }
            let first = sinon.spy(asyncThunk);
            consume(first);
            expect(first.called).to.equal(true);
            consume(second);
            expect(second.called).to.equal(false);
        });
    });

    describe('inject', () => {
        let api = {};
        let globals = {};
        let consume = inject(api, globals)(run);

        it('should be able to supply extra arguments to thunk', () => {
            let thunk = sinon.spy();
            consume(thunk);
            expect(thunk.called).to.equal(true);
            let args = thunk.getCall(0).args;
            expect(args.length).to.equal(4);
            expect(typeof args[0]).to.equal('function');
            expect(typeof args[1]).to.equal('function');
            expect(args[2]).to.equal(api);
            expect(args[3]).to.equal(globals);
        });
    });

    describe('injectWith', () => {
        let api = {};
        let globals = {};
        let consume = injectWith(() => api, () => globals)(run);

        it('should be able to supply extra arguments from factory functions to thunk', () => {
            let thunk = sinon.spy();
            consume(thunk);
            expect(thunk.called).to.equal(true);
            let args = thunk.getCall(0).args;
            expect(args.length).to.equal(4);
            expect(typeof args[0]).to.equal('function');
            expect(typeof args[1]).to.equal('function');
            expect(args[2]).to.equal(api);
            expect(args[3]).to.equal(globals);
        });
    });
});

describe('reduceConsumers', () => {
    it('should merge multiple consumers into one', () => {
        let result = [];
        let first = run => thunk => {
            result.push('first');
            run(thunk);
        };
        let second = run => thunk => {
            result.push('second');
            run(thunk);
        };
        let consume = reduceConsumers(first, second)(run);
        consume(() => {});
        expect(result).to.deep.equal(['first', 'second']);
    });
});
