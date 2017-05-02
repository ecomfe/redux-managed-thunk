# redux-managed-thunk

redux-managed-thunk是一个redux中间件，基于thunk提供了强大的异步管理功能。

## 一些想法

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
    dispatch.done({type: 'ADD_TODO', palyoad: savedTodo});
};
```

通过提供`dispatch.done`和`dispatch.fail`函数来标记流程的结束，但这种形式在用户不小心忘记调用这些函数时，依旧无法明确标识出流程的结束，进一步使得对异步流程的管理出现问题（如将所有异步串行化时，因为一个流程无法结束导致所有后续流程不再运行）。

而Promise则存在着一系列的优势，使其成为异步流控制的良好选择：

- 标准支持，符合所有人的预期。
- ES2018后由语法上的`async`和`await`支持，配合`Promise.all`等方法易于进行异步流控制。

### 为什么不使用迭代器

从“一个业务流程中，分阶段地派发多个Action”这个逻辑角度而言，迭代器是一个很好的解决方案，并且标准已经有[异步迭代器](https://github.com/tc39/proposal-async-iteration)将迭代与异步进行整合。

但是在实际的开发中，我们面对的往往是各种各样的流（Stream）和事件（Event），将这两者转换为迭代器是非常复杂的，例如：

```javascript
let fetchList = async function* () {
    let xhr = ajax('/list?ndjson');
    // 很显然并不能在事件处理函数中使用yield，那么这代码就不能用
    xhr.onprogress = line => yield {type: 'ADD_ITEM', payload: JSON.parse(line)};
};
```

```javascript
let fetchList = () => {
    let xhr = ajax('/list?ndjson');
    xhr.onprogress = line => {
        // 如果自己实现迭代器，这里的实现又会相当复杂
    };

    return {
        [Symbol.asyncIterator]: {
            next() {
                // 如何与事件整合起来
            }
        }
    }
};
```

因此，迭代器并不适合与组织实际的业务逻辑。

## Thunk类型

在redux-managed-thunk中，你可以通过`dispatch`派发函数，这一点上与[redux-thunk](https://github.com/gaearon/redux-thunk)一致。但是redux-managed-thunk在执行异步逻辑时，需要返回一个Promise对象用以标记流程的状态。

大部分时候，只需要将thunk标记为`async`即可复用语言特性达到返回Promise的目的：

```javascript
import {post} from 'http-api';

// 本身的实现和redux-thunk一模一样
let saveTodo = todo => async dispatch => {
    dispatch({type: 'SAVE_START'});

    let savedTodo = await post('/todos', todo);
    dispatch(type: 'ADD_TODO', payload: savedTodo);

    dispatch {type: 'SAVE_DONE'};
}
```

redux-managed-thukn会对`dispatch`参数增加一些限制：

- 如果thunk并没有返回Promise，那么该函数返回后继续调用`dispatch`会抛出异常。
- 如果thunk返回Promise，那么在Promise进行fulfilled状态后继续调用`dispatch`会抛出异常。

进行额外的检测并抛出异常是为了帮助应用更好地管理异步过程，避免未知时机的`dispatch`调用产生不可预期的应用状态。

## 管理thunk

redux-managed-thunk允许从2个层面对thunk的执行进行管理。

### 全局thunk派发

redux-managed-thunk允许自定义`consumer`函数对所有派发的thunk的执行方式进行管理，在调用`managedThunk`创建中间件时提供参数即可，如：

```javascript
import {managedThunk, series} from 'redux-managed-thunk';
import {applyMiddleware} from 'redux';

applyMiddleWare(managedThunk(null, {consumer: series()}));
```

以上代码使用`series`处理所有派发的thunk，其逻辑是将逻辑的执行串行化，前一个thunk结束前，后续的thunk必须排队等待。

除此之外，可以使用更多的函数组织对thunk的派发逻辑：

```javascript
import {managedThunk, series, inject, reduceConsumers} from 'redux-managed-thunk';
import {applyMiddleware} from 'redux';

let api = {
    // ...
};
applyMiddleWare(managedThunk({consumer: reduceConsumers(inject(api), series())}));
```

以上代码通过`reduceConsumers`函数将`inject`和`series`整合在一起，形成的逻辑为“执行时额外提供一个`api`参数，并且所有thunk按顺序依次派发”。

你也可以编写自己的`consumer`函数，每一个`consumer`函数符合以下签名：

```javascript
let consumer = run => thunk => {
    // 调用run(thunk)即可执行thunk
    //
    // 返回Promise则表示异步
};
```

如内置的`inject`用于为所有的thunk提供额外的参数，可以实现类似redux-thunk的`extraArgument`的效果，并且具备更好的灵活性（允许多个参数），其实现简单地对传入的`thunk`进行包装增加额外参数：

```javascript
export let inject = (...extraArguments) => run => thunk => {
    let withInjection = (...args) => thunk(...args, ...extraArguments);
    run(withInjection);
};
```

如果考虑到使用大量的可变参数会使性能下降，那么在**确认thunk的签名不变**的前提下，可以很简单地实现一个简化版本：

```javascript
export let inject = extraArgument => run => thunk => {
    let withInjection = (dispatch, getState) => thunk(dispatch, getState, extraArgument);
    run(withInjection);
};
```

这一版本通过固定额外参数仅有一个并且保证在生效前没有其它类似`inject`的consumer改变thunk的参数可以获得更好的性能。

### 单个thunk派发

对于不同的thunk，我们有时候也需要对其进行管理，常见的有：

- 对于类似GET只读资源的请求，如果同时调用N次，那么基于幂等性（虽然往往不现实），可以复用第一次请求的结果。
- 对于类似PUT的更新请示，如果同时调用N次，那么应该最后一次生效，前面的调用可以被取消。

我们可以使用高阶Action Creator（Higher-order Action Creator）来实现这些：

```javascript
import {reusePrevious, cancelPrevious} from 'redux-managed-thunk';
import {get, put} from 'http-api';

let fetchTodo = id => async () => get(`/todos/${id}`);
// 复用之前已经开始的thunk
fetchTodo = reusePrevious(fetchTodo);

let updateTodo = todo => async () => put(`/todos/${todo.id}`, todo);
// 取消之前开始的thunk
updateTodo = cancelPrevious(updateTodo);
```

使用不同的高阶函数可以产生不同的效果，如使用了`cancelPrevious`之后，当新的thunk开始执行时，之前未执行完的thunk所产生的Action都将被忽略（已产生的Action则已经生效）。

同样，可以编写自己的高阶函数，高阶函数的签名为：

```javascript
// 接收一个Action Creator，返回一个新的Action Creator
next => (...args) => (dispatch, getState) => {
    // 实现对thunk的管理，需要时调用next
};
```

如`reusePrevious`的简单实现为：

```javascript
let reusePrevious = next => {
    let currentRunningTask = null;
    let currentTaskInput = null;

    let clean = () => {
        currentRunningTask = null;
        currentTaskInput = null;
    };

    return (...args) => (dispatch, getState, extraArgument) => {
        if (!currentRunningTask || !shallowEqual(args, currentTaskInput)) {
            currentTaskInput = args;
            currentRunningTask = next(...args)(dispatch, getState, extraArgument);
            currentRunningTask.then(clean);
        }

        return currentRunningTask;
    };
};
```

而`cancelPrevious`则显得麻烦一些：

```javascript
let cancelPrevious = next => {
    let cancelRunningTask = null;
    let currentTaskInput = null;

    let clean = () => {
        cancelRunningTask = null;
        currentTaskInput = null;
    };

    return (...args) => (dispatch, getState, extraArgument) => {
        if (cancelRunningTask && shallowEqual(args, currentTaskInput)) {
            cancelRunningTask();
            clean();
        }

        let [cancelableDispatch, cancel] = (() => {
            let canceled = false;

            return [
                action => canceled ? null : dispatch(action),
                () => canceled = true
            ];
        })();

        cancelRunningTask = cancel;
        currentTaskInput = args;

        let promise = next(...args)(cancelableDispatch, getState, extraArgument);
        promise.then(clean);
        return promise;
    };
};
```

## 乐观UI支持

redux-managed-thunk同时支持乐观UI，只需将一个`[Function, Function]`形式的数组传递给`dispatch`函数即可，这个数组分为2项：

1. 第一项为redux-managed-thunk定义的标准thunk，考虑到乐观UI的特性，该thunk应当是一个异步函数，返回Promise对象。
2. 第二项同样为一个thunk，但必须是同步函数。

当接收到数组时，redux-managed-thunk会优先执行第2个thunk并派发产生的乐观Action更新应用状态，随后当第1个thunk的异步过程结束时，之前产生的乐观Action将被回滚，随后再通过新的Action将应用状态更新至最新。
