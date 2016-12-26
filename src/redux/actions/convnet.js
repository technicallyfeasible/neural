import { actions } from '../reducers/convnet';

function addNet(id, layers) {
  return {
    type: actions.ADD_NET,
    id,
    layers,
  };
}

function addTrainer(id, options) {
  return {
    type: actions.ADD_TRAINER,
    id,
    options,
  };
}

export {
  addNet,
  addTrainer,
};
