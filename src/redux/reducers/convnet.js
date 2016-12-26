import convnet from 'convnet';

const initialState = I.Map({
  nets: I.Map(),
  trainers: I.Map(),
});

export const actions = {
  ADD_NET: 0,
  ADD_TRAINER: 1,
};

export default function (state = initialState, action) {
  const { id, layers, options } = action;
  let net;
  let trainer;
  switch (action.type) {
    case actions.ADD_NET:
      net = new convnet.Net();
      net.makeLayers(layers);
      return state.setIn(['nets', id], net);
    case actions.ADD_TRAINER:
      trainer = new convnet.Trainer(state.getIn(['nets', id]), options);
      return state.setIn(['trainers', id], trainer);
    default:
      return state;
  }
}
