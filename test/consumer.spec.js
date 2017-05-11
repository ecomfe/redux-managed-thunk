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

        it('should return the result of thunk', () => {
            expect(consume(() => 1)).to.equal(1);
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

        it('should return a promise which resolves when thunk complete', async () => {
            let [one, two] = await Promise.all([consume(() => Promise.resolve(1)), consume(() => 2)]);
            expect(one).to.equal(1);
            expect(two).to.equal(2);
        });

        it('should reject promise when thunk throws', async () => {
            try {
                let result = await consume(() => Promise.reject(2));
                throw 'should not run this line of code';
            }
            catch (ex) {
                expect(ex).to.equal(2);
            }
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

        it('should return the result of thunk', () => {
            let thunk = () => 1;
            expect(consume(thunk)).to.equal(1);
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

        it('should return the result of thunk', () => {
            let thunk = () => 1;
            expect(consume(thunk)).to.equal(1);
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
