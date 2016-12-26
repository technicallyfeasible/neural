require('extensible-polyfill').patch('immutable');

const React = require('react');
const ReactDOM = require('react-dom');
const { Provider } = require('react-redux');

const App = require('./containers/App');
const store = require('./redux');

window.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render((
    <Provider store={store}>
      <App />
    </Provider>
  ), document.getElementById('root'));
});
