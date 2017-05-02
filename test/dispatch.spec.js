import {expect} from 'chai';
import sinon from 'sinon';
import {createDispatch, error, ignore} from '../src/index';

let actualDispatch = thunk => thunk();

describe('createDispatch', () => {
    it('should return a tuple of 2 functions', () => {
        let [dispatch, replaceBehavior] = createDispatch(actualDispatch);
        expect(typeof dispatch).to.equal('function');
        expect(typeof replaceBehavior).to.equal('function');
    });

    it('should use normal as default behavior', () => {
        let dispatch = createDispatch(actualDispatch)[0];
        let spy = sinon.spy();
        dispatch(spy);
        expect(spy.called).to.equal(true);
    });
});

describe('built-in dispatch behaviors', () => {
    describe('error', () => {
        let [dispatch, replaceBehavior] = createDispatch(actualDispatch);
        replaceBehavior(error('My error'));

        it('should throw error', () => {
            expect(() => dispatch(() => {})).to.throw('My error');
        });
    });

    describe('ignore', () => {
        let [dispatch, replaceBehavior] = createDispatch(actualDispatch);
        replaceBehavior(ignore());

        it('should ignore all actions', () => {
            let spy = sinon.spy();
            dispatch(spy);
            expect(spy.called).to.equal(false);
        });
    });
});
