import { combineReducers } from 'redux-immutable';
import { createStore } from 'redux';

import convnet from './reducers/convnet';

const initialState = I.Map();
const rootReducer = combineReducers({
  convnet,
});

const store = createStore(rootReducer, initialState);
export default store;
