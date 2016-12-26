import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as convnetActionBuilders from '../redux/actions/convnet';
import convnet from 'convnet';

const width = 32;
const height = 32;
const numSliders = 1;
const zoom = 10;
const iterations = 10;
const trainingSet = [];

class Art extends Component {
  static propTypes = {
    convnetActions: PropTypes.object,
    nets: PropTypes.instanceOf(I.Map),
    trainers: PropTypes.instanceOf(I.Map),
  };

  constructor() {
    super();
    this.state = {
      sliders: [],
      drawing: false,
      lastPos: null,
    };
    for (let i = 0; i < numSliders; i++) {
      this.state.sliders.push(0);
    }
  }
  componentWillMount() {
    this.createNetwork();
  }

  componentDidMount() {
    this.clearImage();
  }

  getImage = () => {
    const canvas = this.refs.capture;
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const gray = [];
    for (let offset = 0; offset < data.data.length; offset += 4) {
      const red = data.data[offset];
      const green = data.data[offset + 1];
      const blue = data.data[offset + 2];
      gray.push((red + green + blue) / (3 * 255));
    }
    const vol = new convnet.Vol(width, height, 1, 0);
    vol.addFrom({ w: gray });
    return vol;
  };

  setImage = (data) => {
    const canvas = this.refs.capture;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    const image = imgData.data;
    let dst = 0;
    for (let src = 0; src < data.w.length; src++, dst += 4) {
      const gray = Math.max(0, Math.min(data.w[src] * 255, 255));
      image[dst] = gray;
      image[dst + 1] = gray;
      image[dst + 2] = gray;
      image[dst + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  };

  setSlider(index, value) {
    const { sliders } = this.state;
    const newSliders = sliders.slice();
    newSliders[index] = value;
    this.setState({
      sliders: newSliders,
    });
  }

  getSliders() {
    const { sliders } = this.state;
    return new convnet.Vol(sliders);
  }

  startDraw() {
    this.setState({
      drawing: true,
    });
  }

  stopDraw() {
    this.setState({
      drawing: false,
    });
  }

  draw(e) {
    const { drawing } = this.state;
    const canvas = this.refs.capture;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left * zoom) / zoom;
    const y = (e.clientY - rect.top * zoom) / zoom;

    if (drawing) {
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000000';
      ctx.beginPath();
      const lastPos = this.lastPos;
      if (!lastPos) {
        ctx.moveTo(x, y);
      } else {
        ctx.moveTo(lastPos.x, lastPos.y);
      }
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    this.lastPos = { x, y };
  }

  clearImage() {
    const canvas = this.refs.capture;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  createNetwork() {
    const { nets: { art: net }, convnetActions } = this.props;
    if (net) return;

    const count = width * height;
    const layerDefs = [];
    layerDefs.push({ type: 'input', out_sx: 1, out_sy: 1, out_depth: numSliders });
    layerDefs.push({ type: 'fc', num_neurons: 50, activation: 'tanh' });
    layerDefs.push({ type: 'fc', num_neurons: count / 2, activation: 'tanh' });
    layerDefs.push({ type: 'regression', num_neurons: count });
    convnetActions.addNet('art', layerDefs);
    convnetActions.addTrainer('art', {
      method: 'adadelta',
      l2_decay: 0.001,
      batch_size: 1,
    });

    trainingSet.length = 0;
  }

  train(iterate) {
    const { trainers: { art: trainer } } = this.props;

    if (!iterate) {
      const entry = {
        sliders: this.getSliders(),
        image: this.getImage(),
      };
      trainingSet.push(entry);
      trainer.train(entry.sliders, entry.image.w);
    } else {
      for (let i = 0; i < iterations; i++) {
        trainingSet.forEach(entry => {
          trainer.train(entry.sliders, entry.image.w);
        });
      }
    }

    this.clearImage();
  }

  generate() {
    const { nets: { art: net } } = this.props;
    const result = net && net.forward(this.getSliders());
    this.setImage(result);
  }

  render() {
    const { sliders } = this.state;

    const sliderElements = sliders.map((val, index) => (
      <input key={index} type="range" min={0} max={1} step={0.01} value={val} onChange={(e) => this.setSlider(index, e.target.value)} />
    ));

    return (
      <div>
        <button onClick={e => this.createNetwork(e)}>Create Network</button>
        <button onClick={() => this.train()}>Train</button>
        <button onClick={() => this.train(true)}>Iterate</button>
        <button onClick={e => this.generate(e)}>Make Art</button>
        <button onClick={e => this.clearImage(e)}>Clear image</button>
        <div>Sliders</div>
        { sliderElements }
        <div>Image ({ trainingSet.length })</div>
        <div style={{ borderWidth: 1, borderStyle: 'solid', display: 'inline-block', userSelect: 'none' }}>
          <canvas
            ref="capture"
            width={width}
            height={height}
            style={{ zoom, imageRendering: 'pixelated' }}
            onMouseDown={() => this.startDraw()}
            onMouseUp={() => this.stopDraw()}
            onMouseMove={(e) => this.draw(e)}
          />
        </div>
      </div>
    );
  }
}

export default connect(
  store => ({
    nets: store.getIn(['convnet', 'nets']),
    trainers: store.getIn(['convnet', 'trainers']),
  }),
  dispatch => ({ convnetActions: bindActionCreators(convnetActionBuilders, dispatch) }),
)(Art);
