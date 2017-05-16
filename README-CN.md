# redux-managed-thunk
[![building status](https://img.shields.io/travis/ecomfe/redux-managed-thunk.svg?style=flat)](https://travis-ci.org/ecomfe/redux-managed-thunk)
[![Coverage Status](https://img.shields.io/coveralls/ecomfe/redux-managed-thunk.svg?style=flat)](https://coveralls.io/github/ecomfe/redux-managed-thunk)
[![NPM version](https://img.shields.io/npm/v/redux-managed-thunk.svg?style=flat)](https://www.npmjs.com/package/redux-managed-thunk)

redux-managed-thunk是一个redux中间件，基于thunk提供了强大的异步管理功能。

- [基本理念](#基本理念)
- [基本使用方式](#基本使用方式)
    - [与redux-thunk的差异](#与redux-thunk的差异)
- [dispatch可用性限制](#dispatch可用性限制)
- [使用consumer扩展中间件](#使用consumer扩展中间件)
    - [节流与串行化](#节流与串行化)
    - [依赖注入](#依赖注入)
    - [组合consumer](#组合consumer)
    - [自定义consumer](#自定义consumer)
- [高阶ThunkCreator](#高阶thunk-creator)
    - [复用前次Thunk](#复用前次thunk)
    - [取消前次Thunk](#取消前次thunk)
    - [事务化Thunk](#事务化thunk)
    - [自定义高阶ThunkCreator](#自定义高阶thunk-creator)
- [乐观UI支持](#乐观ui支持)

## 基本理念

该中间件在设计的过程中进行过多次的变更，也在[redux-thunk](https://github.com/gaearon/redux-thunk)、[redux-promise](https://github.com/acdlite/redux-promise)、[redux-generator](https://github.com/xuyuanxiang/redux-generator)之间进行过比较和取舍，最终以现在的形式出现，这其中有着很多的考虑。

### 为什么需要thunk

在[redux-promise](https://github.com/acdlite/redux-promise)中，提供给`dispatch`函数的参数是一个Promise对象，这可以用来处理异步的操作，但是这也同时意味着当`dispatch`运行时，一个异步的过程**已经开始执行**了，中间件将对异步的执行时机、顺序等失去控制，这严重影响了应用整体对异步的管理能力。

### 为什么需要Promise

在一个应用中，异步的逻辑是不可避免的，而对异步的处理方式各个中间件也有不同的思路。最为流行的redux-thunk选择提供一个`dispatch`参数以供随时调用，但其带来的代价是由于`dispatch`在任意时刻均可调用，因此**无法知晓一个逻辑何时结束，其结果是成功还是失败**。

因此我们需要有一个模式去标记流程的结束和结果成功与否，一种基于thunk的简单扩展方案是提供额外的回调函数：

```javascript
let saveTodo = todo => async dispatch => {
    dispatch({type: 'SAVE_START'});

    let savedTodo = await post('/todos', todo);

    // 使用dispatch.done标记结束
    dispatch.done({type: 'ADD_TODO', payload: savedTodo});
};
```

通过提供`dispatch.done`和`dispatch.fail`函数来标记流程的结束，但这种形式在用户不小心忘记调用这些函数时，依旧无法明确标识出流程的结束，进一步使得对异步流程的管理出现问题（如将所有异步串行化时，因为一个流程无法结束导致所有后续流程不再运行）。

而Promise则存在着一系列的优势，使其成为异步流控制的良好选择：

- 标准支持，符合所有人的预期。
- ES2018后由语法上的`async`和`await`支持，配合`Promise.all`等方法易于进行异步流控制。

## 基本使用方式

通过npm或yarn进行安装：

```shell
npm install --save redux-managed-thunk
# 或者
yarn add redux-managed-thunk
```

redux-managed-thunk的默认export为一个中间件创建函数，调用可产生一个中间件，随后通过`applyMiddleware`使用即可：

```javascript
import {createStore, applyMiddleware} from 'redux';
import managedThunk from 'redux-managed-thunk';

let store = createStore(
    reducer,
    preloadedState,
    applyMiddleware(managedThunk())
);
```

注意与redux-thunk不同的是，`managedThunk`是一个“创建中间件的函数”，而非一个中间件，所以需要进行一次调用。`managedThunk`函数还接受一个`options`参数，包含以下的属性：

- `{boolean} loose`：用于开启宽松模式，具体参考[dispatch可用性限制](#dispatch可用性限制)章节。
- `{Function} consumer`：用于控制thunk的派发逻辑，具体参考[使用consumer扩展中间件](#使用consumer扩展中间件)章节。

### 与redux-thunk的差异

在一个redux中间件中，开发者可以访问到2个不同的`dispatch`函数，其一是挂载在`store`对象上的全局的`dispatch`函数，另一个被称之为`next`，用于访问中间件链中的后续中间件。

redux-thunk在调用thunk时，将全局`dispatch`函数作为第一个参数传递给了thunk。但redux-managed-thunk使用的则是`next`函数，这是为了让[乐观UI](#乐观ui支持)可用而作出的设计。

如果你只使用redux-managed-thunk这一个中间件，或者redux-managed-thunk是`applyMiddleware`的第一个参数，那么这一差异并不会产生任何的影响。但如果你在redux-managed-thunk的**前面**还有其它的中间件，那么需要注意在thunk中调用`dispatch`时，之前的中间件并不会起作用。

## dispatch可用性限制

redux-managed-thukn会对`dispatch`参数增加一些限制：

- 如果thunk并没有返回Promise，那么该函数返回后继续调用`dispatch`会抛出异常。
- 如果thunk返回Promise，那么在Promise进行fulfilled状态后继续调用`dispatch`会抛出异常。

进行额外的检测并抛出异常是为了帮助应用更好地管理异步过程，避免未知时机的`dispatch`调用产生不可预期的应用状态。

如果你希望兼容redux-thunk的方式，任意使用`dispatch`不受限制，那么在创建中间件的时候传入`{loose: true}`参数即可：

```javascript
import {createStore, applyMiddleware} from 'redux';
import managedThunk from 'redux-managed-thunk';

let store = createStore(
    reducer,
    preloadedState,
    applyMiddleware(managedThunk({loose: true}))
);
```

## 使用consumer扩展中间件

redux-managed-thunk允许自定义`consumer`函数对所有派发的thunk的执行方式进行管理，在调用`managedThunk`创建中间件时提供参数即可。本库内置了一系列常用的cosumer函数。

### 节流与串行化

使用`cocurrency`函数可以支持“同一时间最多同时派发N个thunk”的管理逻辑：

```javascript
cocurrency = ({number} limit) => Function
```

如我们为了控制服务器端的压力，允许同一时间最多派发4个thunk：


```javascript
import {managedThunk, cocurrency} from 'redux-managed-thunk';
import {applyMiddleware} from 'redux';

applyMiddleWare(managedThunk(null, {consumer: cocurrency(4)}));
```

也可以使用`series`函数来将所有thunk串行化（相当于`cocurrency(1)`），这在类似electron这类renderer和main交互速度很快的应用中能起到简单防止竞态（Race Condition）的作用：

```javascript
import {managedThunk, series} from 'redux-managed-thunk';
import {applyMiddleware} from 'redux';

applyMiddleWare(managedThunk(null, {consumer: series()}));
```

### 依赖注入

使用`inject`和`injectWith`函数可以对thunk的参数进行注入，效果类似于redux-thunk的`withExtraArgument`函数的功能：

```javascript
inject = ({...any} extraArguments) => Function
injectWith ({...Function} factories) => Function
```

两者的区别在于`injectWith`的参数为若干个函数，在每一次thunk执行时会运行这些函数并使用其返回值作为参数注入到thunk中，而`inject`则直接将值作为参数。`injectWith`的工厂函数并不支持异步。

```javascript
import {managedThunk, injectWith} from 'redux-managed-thunk';
import {identity} from 'lodash';
import {applyMiddleware} from 'redux';

let api = {
    // ...
};
let getCurrentUser = () => window.currentUser || null;

applyMiddleWare(managedThunk(null, {consumer: injectWith(identity(api), getCurrentUser)}));

// 随后thunk可以获取参数
let invalidCurrentUser = async (dispatch, getState, api, currentUser) => {
    if (!currentUser) {
        window.currentUser = await api.getCurrentUser();
        return dispatch(thunk);
    }

    dispatch({type: 'INVALID_USER', payload: currentUser});
};
```

### 组合consumer

使用`reduceConsumers`函数可以将多个consumer组合为一个，如同时需要`inject`和`series`功能：

```javascript
import {managedThunk, series, inject, reducerConsumers} from 'redux-managed-thunk';
import {identity} from 'lodash';
import {applyMiddleware} from 'redux';

let api = {
    // ...
};

applyMiddleWare(managedThunk(null, {consumer: reducerConsumers(series(), inject(api))}));
```

### 自定义consumer

你可以任意自定义consumer函数，一个consumer函数符合以下签名：

```javascript
consumer = ({Function} run) => ({Function({Function} thunk)}) => any;
```

其接收一个`run`函数，该函数仅接收一个`thunk`函数并返回其执行结果。一个consumer函数在接收到thunk后如无意外应当返回thunk的执行结果（`any`）。

以下示例为一个允许函数异步返回依赖的`injectWith`函数：

```javascript
let injectWithAsync(...factories) => run => async thunk => {
    let extraArguments = await Promise.all(factories.map(fn => fn()));
    let injectedThunk = (...args) => thunk(...args, ...extraArguments);
    return run(injectedThunk);
};
```

## 高阶Thunk Creator

一个Thunk符合以下签名：

```javascript
Thunk = ({Function} dispatch, {Function} getState, {...Function} extraArguments) => any
```

一个Thunk Creator是一个创建Thunk的函数：

```javascript
ThunkCreator = ({...any} arguments) => Thunk
```

一个高阶Thunk Creator则是一个高阶函数，其接收一个Thunk Creator并返回一个新的Thunk Creator，用以添加一些可复用的行为：

```javascript
higherOrderThunkCreator = ({ThunkCreator} next) => ThunkCreator
```

redux-managed-thunk内置了几个常用的高阶ThunkCreator用于在Thunk级别对流程进行管理。

### 复用前次Thunk

在基于HTTP协议的应用中，对于一些假定幂等的请求（如`GET`），当其参数相同时，我们往往没有必要重复发起请求。`reusePrevious`提供了复用前次的功能，当前一次的thunk仍在运行中，则不会执行新的thun，而是将前一次的结果（`Promise`）直接返回。

`reusePrevious`接收的`options`参数有如下属性：

- `{Function} shouldReuse`：接受`(currentArgs, previousArgs)`并返回`boolean`来确定是否可以重用前次执行，默认实现为对前后的参数一一进行`shallowEqual`的比较。

```javascript
import {reusePrevious} from 'redux-managed-thunk';

let equal = (x, y) => x === y;
let fetchUser = id => async dispatch => {
    let user = http.get(`/users/${id}`);
    dispatch({type: 'USER_ARRIVE', payload: user});
};
fetchUser = reusePrevious({shouldReuse: equal})(fetchUser);

fetchUser(123);
// 并不会执行，直接复用前一次的请求，最后仅有一次dispatch调用
fetchUser(123);
```

### 取消前次Thunk

对于另一类逻辑，如`PUT`请求，后来者总会对前者的结果进行覆盖，因此当一个新的请求开始时，前一次的请求就不再有意义。`cancelPrevious`提供了取消前次的功能，当一个新的thunk开始执行时，前一次的执行产生的`dispatch`调用都将被忽略。

需要注意的是，事实上在JavaScript领域中我们是无法真正“取消”一个操作的，因此对于`cancelPrevious`来说它仅仅忽略了后续的`dispatch`调用，而在之前已经产生的`dispatch`也无法进行回滚。如果需要避免在取消前就产生某些`dispatch`调用，可以配合[`transactional`](#事务化Thunk)一起使用。另外如果有明确地取消请求的方法，则可以使用`cancel`选项来实现。

`cancelPrevious`接收的`options`参数有如下属性：

- `{Function} shouldCancel`：接受`(currentArgs, previousArgs)`并返回`boolean`来确定是否可以重用前次执行，默认实现为对前后的参数一一进行`shallowEqual`的比较。
- `{Function} cancel`：接受当前正在执行的`Promise`对象并完成实际的取消工作，默认为空函数。

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
// 会立即取消前一次请求，仅将name更新至y
updateUser({id: 123, name: 'y'});
```

### 事务化Thunk

`transactional`函数会将一次thunk运行过程中的所有`dispatch`调用暂存起来，在thunk运行成功后一次性派发。如果thunk运行失败（同步的抛出异常或异步地产生`Promsie#reject`），则所有的`dispatch`都将被丢弃：

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
// 由于抛出异常，在事务中内容为"decrenmenting..."的日志不会产生
decrementCounter();
```

### 自定义高阶Thunk Creator

你也可以自己编写需要的高阶ThunkCreator，只需要符合接收一个ThunkCreator并返回新的ThunkCreator的签名即可，如下示例为让某个Thunk运行时在控制台显示函数已经弃用的信息：

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

## 乐观UI支持

redux-managed-thunk同时支持乐观UI，你可以使用`optimisticEnhancer`这一命名导出来打开乐观UI的支持。`optimisticEnhancer`是一个创建Redux StoreEnhancer的函数，用于`createStore`的第3个参数：

```javascript
import {createStore} from 'redux';

let store = createStore(reducer, preloadedState, optimisticEnhancer());
```

如果与其它的enhancer共用，则可以使用compose函数组合：


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

`optimisticEnhancer`函数接受一个`options`参数，参数定义与默认导出的`managedThunk`函数一致。

乐观UI的使用方式与[redux-optimistic-thunk](https://github.com/ecomfe/redux-optimistic-thunk)相同，只需将一个`[Function, Function]`形式的数组传递给`dispatch`函数即可，这个数组分为2项：

1. 第一项为redux-managed-thunk定义的标准thunk，考虑到乐观UI的特性，该thunk应当是一个异步函数，返回Promise对象。如果该函数为同步函数，则会抛出异常。
2. 第二项同样为一个thunk，但必须是同步函数。如果该函数为异步函数，则会抛出异常。

当接收到数组时，redux-managed-thunk会按以下步骤进行：

1. 执行第1个thunk，此时该thunk**同步**产生的action都将生效。
2. 执行第2个thunk，该thunk产生的action都将生效。
3. 等待第1个thunk第一次**异步**调用`dispatch`函数，随后回滚第2个thunk产生的action。
4. 继续派发第1个thunk后续的action。

redux-managed-thunk已经通过事务标注的形式处理了各个thunk之间的乱序问题，使用者无需担心thunk的执行顺序会对乐观UI产生影响。
