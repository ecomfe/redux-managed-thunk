# redux-managed-thunk
[![building status](https://img.shields.io/travis/ecomfe/redux-managed-thunk.svg?style=flat)](https://travis-ci.org/ecomfe/redux-managed-thunk)
[![Coverage Status](https://img.shields.io/coveralls/ecomfe/redux-managed-thunk.svg?style=flat)](https://coveralls.io/github/ecomfe/redux-managed-thunk)
[![NPM version](https://img.shields.io/npm/v/redux-managed-thunk.svg?style=flat)](https://www.npmjs.com/package/redux-managed-thunk)

redux-managed-thunk is a redux middleware which allows you to dispatch thunks with built-in async flow management.

[中文版](README-CN.md)

- [Oringinal idea](#oringinal-idea)
- [How to use](#how-to-use)
    - [Breaking changes with redux-thunk](#breaking-changes-with-redux-thunk)
- [Limit on dispatch](#limit-on-dispatch)
- [Use consumer to extend middleware](#use-consumer-to-extend-middleware)
    - [Cocurrency limit and series](#cocurrency-limit-and-series)
    - [Dependency injection](#dependency-injection)
    - [Combine multiple consumers](#combine-multiple-consumers)
    - [Write a consumer](#write-a-consumer)
- [Higher order thunk creator](#higher-order-thunk-creator)
    - [Reuse previous thunk](#reuse-previous-thunk)
    - [Cancel previous thunk](#cancel-previous-thunk)
    - [Make thunk transactional](#make-thunk-transactional)
    - [Write a higher order thunk creator](#write-a-higher-order-thunk-creator)
- [Optimistic UI support](#optimistic-ui-support)

## Oringinal idea

The design of this middleware changes over time, I have been continuously comparing it to [redux-thunk](https://github.com/gaearon/redux-thunk), [redux-promise](https://github.com/acdlite/redux-promise) and [redux-generator](https://github.com/xuyuanxiang/redux-generator) and finally comes to current design.

### Why do we need a thunk

As of [redux-promise](https://github.com/acdlite/redux-promise) you provide a Promise instance to `dispatch` function, this can be easy to create an async workflow, however when you can provide a Promise instance, the async logic is **already started**, which means middleware lost the ability to control when to start an async flow or how all async flows should be aligned, as a result, you get a unknown number of uncontrolled async workflows unless you manage them yourself.

### Why do we pick promise

Async is an important part of application, however we have different solutions to handle async workflows. The popular redux-thunk middleware chooses to provide a `dispatch` function which can be invoked at any time, but in this way we could never know **when an async workflow ends** and **whether that flow succeeds or fails**.

In this point we need a method to mark the result of an async workflow, one solution is to add extra callback function:

```javascript
let saveTodo = todo => async dispatch => {
    dispatch({type: 'SAVE_START'});

    let savedTodo = await post('/todos', todo);

    // dispatch.done to report success
    dispatch.done({type: 'ADD_TODO', payload: savedTodo});
};
```

Invocation of `dispatch.done` and `dispatch.fail` marks the result of an asyn workflow, but users may forget to call these function and breaks async management (e.g. a never-end async breaks the series management).

Promise comes with a bunch of features to make it a better async flow control intrastructure:

- Supported as a standard, behavior explicitly defined.
- `async` and `await` keywords are supported by babel currently, which made control flow simple combined with `Promise.all`.

## How to use

To install redux-managed-thunk via npm or yarn:

```shell
npm install --save redux-managed-thunk
# or
yarn add redux-managed-thunk
```

The default export is a function which creates a redux middleware, use `applyMiddleware` later to combine it with redux:

```javascript
import {createStore, applyMiddleware} from 'redux';
import managedThunk from 'redux-managed-thunk';

let store = createStore(
    reducer,
    preloadedState,
    applyMiddleware(managedThunk())
);
```

Note that unlike redux-thunk whose default export is a middleware already, `managedThunk` is a function, you must invoke it to get the middleware. `managedThunk` also accepts an `options` argument containing properties below:

- `{boolean} loose`: enable loose mode, see [Limit on dispatch](#limit-on-dispatch) for detail.
- `{Function} consumer`: a consumer function to control the dispatching of thunks, see [Use consumer to extend middleware](#use-consumer-to-extend-middleware) for detail.

### Breaking changes with redux-thunk

There are 2 `dispatch` functions in a redux middleware, one is the global `dispatch` attached with `store` object, the other one is what we called `next` in a middleware chain.

redux-thunk provides the global `dispatch` function to thunks, however redux-managed-thunk provides the `next` function in order to make [optimistic UI](#optimistic-ui-support) to work.

This will not introduce any issue if you only use one middleware or you place redux-managed-thunk as the first argument of `applyMiddleware` function, however if you have some other middlewares **before** redux-managed-thunk, note they will not apply when you call `dispatch` in a thunk.

## Limit on dispatch

redux-managed-thunk adds several constraints to the `dispatch` argument of your thunk:

- If your thunk does not return Promise, calling `dispatch` after thunk returns will throw an error.
- If your thunk returns Promise, calling `dispatch` after promise resolves or rejects will throw an error.

By including extra state check this middleware can help to prevent unknown `dispatch` invocation to cause unexpected application state, so that managing async workflows is more reliable.

If you want a 100% redux-thunk compatible API and using `dispatch` at any time, just pass a `{loose: true}` option when creating the middleware:

```javascript
import {createStore, applyMiddleware} from 'redux';
import managedThunk from 'redux-managed-thunk';

let store = createStore(
    reducer,
    preloadedState,
    applyMiddleware(managedThunk({loose: true})) // Passing loose to be redux-thunk compatible
);
```

## Use consumer to extend middleware

redux-managed-thunk comes with a mechanism called `consumer` which controls the invocation of thunk, you can pass a custom `consumer` function property when creating the middleware, this library includes several built-in consumer functions.

### Cocurrency limit and series

The `cocurrency` consumer function allows a maximum number of thunks running at one time:

```javascript
cocurrency = ({number} limit) => Function
```

For example, if we decide to limit the cocurrency to 4 to keep server stress at a low level:

```javascript
import {managedThunk, cocurrency} from 'redux-managed-thunk';
import {applyMiddleware} from 'redux';

applyMiddleWare(managedThunk(null, {consumer: cocurrency(4)}));
```

A special case is `series` consumer function, it limits the cocurrency to 1, which means all thunk will run one by one (as `cocurrency(1)`), this can be useful in electron-like environment in which the main and renderer communication is superfase, series dispatching can simply elliminate race conditions:

```javascript
import {managedThunk, series} from 'redux-managed-thunk';
import {applyMiddleware} from 'redux';

applyMiddleWare(managedThunk(null, {consumer: series()}));
```

### Dependency injection

The `inject` and `injectWith` consumer function can inject extra arguments to thunks, it works like redux-thunk's `withExtraArgument` function but have the ability to pass multiple arguments:

```javascript
inject = ({...any} extraArguments) => Function
injectWith ({...Function} factories) => Function
```

The `injectWith` function accepts any number of functions, calls each function and inject the return value to thunks, instead `inject` simply injects given arguments to thunks. `injectWith` does not support async functions.

```javascript
import {managedThunk, injectWith} from 'redux-managed-thunk';
import {identity} from 'lodash';
import {applyMiddleware} from 'redux';

let api = {
    // ...
};
let getCurrentUser = () => window.currentUser || null;

applyMiddleWare(managedThunk(null, {consumer: injectWith(identity(api), getCurrentUser)}));

// Thunk can get the return value of functions
let invalidCurrentUser = async (dispatch, getState, api, currentUser) => {
    if (!currentUser) {
        window.currentUser = await api.getCurrentUser();
        return dispatch(thunk);
    }

    dispatch({type: 'INVALID_USER', payload: currentUser});
};
```

### Combine multiple consumers

The `reduceConsumers` function combines multiple consumers from left to right, for example we combine `inject` and `series` together:

```javascript
import {managedThunk, series, inject, reducerConsumers} from 'redux-managed-thunk';
import {identity} from 'lodash';
import {applyMiddleware} from 'redux';

let api = {
    // ...
};

applyMiddleWare(managedThunk(null, {consumer: reducerConsumers(series(), inject(api))}));
```

### Write a consumer

You can also write a custom consumer function, consumer is simply a function which matches signature:

```javascript
consumer = ({Function} run) => ({Function({Function} thunk)}) => any;
```

A consumer function receives a `run` function, caling this function returnes the result of thunk. A consumer **SHOULD** return the result of thunk (`any`).

As an example, we implement an `injectWith` consumer function which accepts async functions:

```javascript
let injectWithAsync(...factories) => run => async thunk => {
    let extraArguments = await Promise.all(factories.map(fn => fn()));
    let injectedThunk = (...args) => thunk(...args, ...extraArguments);
    return run(injectedThunk);
};
```

## Higher order thunk creator

A thunk is a function with signature:

```javascript
Thunk = ({Function} dispatch, {Function} getState, {...Function} extraArguments) => any
```

A thunk creator is a function which creates a thunk:

```javascript
ThunkCreator = ({...any} arguments) => Thunk
```

A higher order thunk creator is a function which receives a thunk creator and returns a new thunk creator, it can add custom behaviors to thunk creators:

```javascript
higherOrderThunkCreator = ({ThunkCreator} next) => ThunkCreator
```

redux-managed-thunk has some built-in higher order thunk creators.

### Reuse previous thunk

In HTTP environment, some idempotent requests (such as `GET`) will return the same response if given the same arguments, so we don't need to start a new request every time, by just reusing the previous request if it doesn't finish we can save network roundtrips. The `reusePrevious` higher order thunk creator provides the functionality to reuse a pending thunk, it simply returns the Promise instance returned by previous reusable thunk.

The `reusePrevious` function accepts an `options` argument containing properties:

- `{Function} shouldReuse`: a function accepts `(currentArgs, previousArgs)` and returns a boolean to determine whether to reuse previous result, the default implement is to compare each argument by `shallowEqual`.

```javascript
import {reusePrevious} from 'redux-managed-thunk';

let equal = (x, y) => x === y;
let fetchUser = id => async dispatch => {
    let user = http.get(`/users/${id}`);
    dispatch({type: 'USER_ARRIVE', payload: user});
};
fetchUser = reusePrevious({shouldReuse: equal})(fetchUser);

fetchUser(123);
// This will not start a new request
fetchUser(123);
```

### Cancel previous thunk

Other than idempotent logic, some requests (such as `PUT`) will always overwrite the previous action, so if a new request is started, the previous one will be "useless", by cancelling it can save some network roundtrips or application state changes. The `cancelPrevious` higher order thunk creator provides this functionality, when a new thunk starts to run, all later `dispatch` calls from previous thunk will be ignored.

An important thing to note is we don't have a standard cancellation mechanism in JavaScript world, so `cancelPrevious` only **ignores** `dispatch` calls, all previously calls to `dispatch` will not rollback. To prevent `dispatch` calls befor the possible cancellation, use `cancelPrevious` with [`transactional`](make-thunk-transactional) together. you can also provide a `cancel` option to implement the real cancallation logic.

The `cancelPrevious` function accepts an `options` argument containing properties:

- `{Function} shouldCancel`: a function accepts `(currentArgs, previousArgs)` and returns a boolean to determine whether to cancel previous thunk, the default implement is to compare each argument by `shallowEqual`.
- `{Function} cancel`: a function to actually cancel or abort current running thunk, this function will receive the `Promise` instance returned by thunk, the default implement is an empty function.

```javascript
import {reusePrevious} from 'redux-managed-thunk';

let idEqual = (x, y) => x.id === y.id;
let abortFetch = running => running.abort();
let updateUser = user => async dispatch => {
    let updating = http.put(`/users/${user.id}`, user);
    updating.then(updatedUser => dispatch({type: 'USER_UPDATE', payload: updatedUser}));
    return updating;
};
updateUser = cancelPrevious({shouldCancel: idEqual, cancel: abortFetch})(updateUser);

updateUser({id: 123, name: 'x'});
// Cancels previous update, name will directly updated to "y", no {name: "x"} state change will happen
updateUser({id: 123, name: 'y'});
```

### Make thunk transactional

The `transactional` higher order thunk creator will temporarily save all actions dispatched from a thunk, then dispatch them after the thunk successfully finishes, if the thunk failes (throws in sync or rejectes asynchronously), all `dispatch` calls will be dismissed:

```javascript
import {transactional} from 'redux-managed-thunk';

let counter = 1;
let decrementCounter = () => dispatch => {
    dispatch({type: 'LOG', payload: 'decrementing...'});

    if (counter === 0) {
        throw new Error('Cannot decrement');
    }

    counter--;
    dispatch({type: 'NEW_COUNTER', counter});
    dispatch({type: 'LOG', payload: 'decremented'});
};
decrementCounter = transactional()(decrementCounter);

decrementCounter();
// Because this will throw an error, the "decrenmenting..." log will not appear
decrementCounter();
```

### Write a higher order thunk creator

You can write custom higher order thunk creators, they are just pure functions matching the signature, below is an example of a higher order thunk creator which warns thunk deprecation message in console:

```javascript
let deprecated = name => next => (...args) => {
    let thunk = next(...args);
    return (...thunkArgs) => {
        console.warn(`${name} thunk is deprecated`);
        return thunk(...thunkArgs);
    };
};
// myAPI = deprecated('myAPI')(myAPI);
```

## Optimistic UI support

redux-managed-thunk also supports optimistic UI, you can use the `optimisticEnhancer` named export to enable optimistic UI support. The `optimisticEnhancer` is a function which returns a Redux StoreEnhancer, pass it as the third argument of `createStore`:

```javascript
import {createStore} from 'redux';

let store = createStore(reducer, preloadedState, optimisticEnhancer());
```

You can use `compose` function to merge multiple enhancers:

```javascript
import {createStore, compose} from 'redux';
import logger from 'redux-logger';
import saga from 'redux-saga';

let store = createStore(
    reducer,
    preloadedState,
    compose(
        applyMiddleware(logger, saga),
        optimisticEnhancer({/* options */})
    )
);
```

The `optimisticEnhancer` function accepts an `options` argument, this argument is directly passed to `managedThunk` function.

The implement of optimistic UI stays the same as [redux-optimistic-thunk](https://github.com/ecomfe/redux-optimistic-thunk), you can pass an action with structure `[Function, Function]` to `dispatch` function:

1. The first function is a standard thunk defined by redux-managed-thunk, this thunk must be async, an error will be thrown if it is sync.
2. The second function is also a thunk but must be sync, an error will be thrown if it is async.

On receiving the array, redux-managed-thunk will perform steps listed below:

1. Run the first thunk, all **synchronously dispatched** actions will be applied.
2. Run the second thunk, all actions will be applied.
3. Wait for the first thunk to invoke `dispatch` **asynchronously**, then rollback actions produced by the second thunk.
4. Dispatch asynchronous actions from the first thunk.

redux-managed-thunk uses a transaction based mechanism to manage all thunks, there will be no race conditions in optimistic UI.
