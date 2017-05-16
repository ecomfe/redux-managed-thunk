/**
 * redux-optimistic-thunk
 *
 * @file react example
 * @author otakustay
 */

import 'babel-polyfill';
import {createStore, compose} from 'redux';
import {render} from 'react-dom';
import {Provider} from 'react-redux';
import {optimisticEnhancer, inject} from '../../src/index';
import * as api from './api';
import reducer from './reducer';
import App from './App.jsx';

let initialState = {
    delay: 10 * 1000,
    items: [
        {id: api.uid(), text: 'Buy a milk', pending: false, deleted: false},
        {id: api.uid(), text: 'Talk with Berry', pending: false, deleted: false},
        {id: api.uid(), text: 'Fitness - Run 10km', pending: false, deleted: false},
        {id: api.uid(), text: 'Read "Node.js for Embedded Systems"', pending: false, deleted: false},
        {id: api.uid(), text: 'Book next week\'s flight ticket', pending: false, deleted: false}
    ]
};
let store = createStore(
    reducer,
    initialState,
    compose(
        optimisticEnhancer({consumer: inject(api)}),
        window.devToolsExtension ? window.devToolsExtension() : f => f
    )
);

render(
    <Provider store={store}>
        <App />
    </Provider>,
    document.body.appendChild(document.createElement('div'))
);
