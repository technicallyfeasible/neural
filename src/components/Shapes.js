import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as convnetActionBuilders from '../redux/actions/convnet';
import convnet from 'convnet';

const width = 400;
const height = 400;
const handleSize = 5;
const numSliders = 2;
const numShapes = 2;
const numShapePoints = 10;
const iterations = 100;
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
      dragging: null,
      shapes: [],
      handles: false,
    };
    for (let i = 0; i < numSliders; i++) {
      this.state.sliders.push(0);
    }
    for (let i = 0; i < numShapes; i++) {
      const x = (Math.random() - 0.5) / 2;
      const y = (Math.random() - 0.5) / 2;
      const r = Math.min(x, y, width - x, height - y) * Math.random();
      let angle = 0;
      const da = 2 * Math.PI / numShapePoints;
      const points = [];
      for (let j = 0; j < numShapePoints; j++, angle += da) {
        points.push({
          x: x + r * Math.cos(angle),
          y: y + r * Math.sin(angle),
        });
      }
      this.state.shapes.push({
        points,
      });
    }
  }
  componentWillMount() {
    this.createNetwork();
  }

  componentDidUpdate() {
    this.drawShapes();
  }

  getShapes = () => {
    const { shapes } = this.state;

    const points = [];
    shapes.forEach(shape => {
      shape.points.forEach(point => {
        points.push(point.x);
        points.push(point.y);
      });
    });
    return new convnet.Vol(points);
  };

  setShapes = (data) => {
    const { shapes } = this.state;

    let index = 0;
    shapes.forEach(shape => {
      shape.points.forEach(point => {
        point.x = data.w[index++];  // eslint-disable-line no-param-reassign
        point.y = data.w[index++];  // eslint-disable-line no-param-reassign
      });
    });

    this.drawShapes();
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

  showHandles(handles) {
    this.setState({
      handles,
    });
  }

  startDrag(e) {
    const { shapes } = this.state;
    const canvas = this.refs.capture;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / width - 0.5;
    const y = (e.clientY - rect.top) / height - 0.5;
    const sx = handleSize / width;
    const sy = handleSize / height;

    let point = null;
    for (let s = 0; s < shapes.length; s++) {
      const shape = shapes[s];
      for (let p = 0; p < shape.points.length; p++) {
        const sp = shape.points[p];
        if (sp.x - sx <= x && sp.x + sx >= x && sp.y - sy <= y && sp.y + sy >= y) {
          point = sp;
          break;
        }
      }
      if (point) break;
    }
    if (!point) return;
    this.setState({
      dragging: point,
    });
  }

  stopDrag() {
    this.setState({
      dragging: null,
    });
  }

  drag(e) {
    const { dragging } = this.state;
    if (!dragging) return;

    const canvas = this.refs.capture;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / width - 0.5;
    const y = (e.clientY - rect.top) / height - 0.5;

    dragging.x = x;
    dragging.y = y;
    this.drawShapes();
  }

  clearImage() {
    const canvas = this.refs.capture;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawShapes() {
    const { shapes, handles, dragging } = this.state;

    this.clearImage();
    const canvas = this.refs.capture;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    shapes.forEach(shape => {
      ctx.beginPath();
      shape.points.forEach((point, i) => {
        const x = (point.x + 0.5) * width;
        const y = (point.y + 0.5) * height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        if (handles) {
          if (dragging === point) {
            ctx.fillStyle = '#00aa00';
          } else {
            ctx.fillStyle = '#0000aa';
          }
          ctx.fillRect(x - handleSize, y - handleSize, handleSize * 2, handleSize * 2);
        }
      });
      ctx.closePath();
      ctx.stroke();
    });
  }

  createNetwork() {
    const { nets: { art: net }, convnetActions } = this.props;
    if (net) return;

    const layerDefs = [];
    layerDefs.push({ type: 'input', out_sx: 1, out_sy: 1, out_depth: numSliders });
    layerDefs.push({ type: 'fc', num_neurons: 50, activation: 'tanh' });
    layerDefs.push({ type: 'fc', num_neurons: 50, activation: 'tanh' });
    layerDefs.push({ type: 'regression', num_neurons: numShapes * 2 * numShapePoints });
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
        shapes: this.getShapes(),
      };
      trainingSet.push(entry);
      trainer.train(entry.sliders, entry.shapes.w);
    } else {
      for (let i = 0; i < iterations; i++) {
        trainingSet.forEach(entry => {
          trainer.train(entry.sliders, entry.shapes.w);
        });
      }
    }
  }

  generate() {
    const { nets: { art: net } } = this.props;
    if (!net) return;
    const result = net.forward(this.getSliders());
    this.setShapes(result);
  }

  render() {
    const { sliders } = this.state;

    const sliderElements = sliders.map((val, index) => (
      <input key={index} type="range" min={0} max={1} step={0.01} value={val} onChange={(e) => this.setSlider(index, e.target.value)} />
    ));

    return (
      <div>
        <button onClick={() => this.createNetwork()}>Create Network</button>
        <button onClick={() => this.train()}>Train</button>
        <button onClick={() => this.train(true)}>Iterate</button>
        <button onClick={() => this.generate()}>Make Art</button>
        <div>Sliders</div>
        { sliderElements }
        <div>Shapes ({ trainingSet.length })</div>
        <div style={{ borderWidth: 1, borderStyle: 'solid', display: 'inline-block', userSelect: 'none' }}>
          <canvas
            ref="capture"
            width={width}
            height={height}
            onMouseEnter={() => this.showHandles(true)}
            onMouseLeave={() => this.showHandles(false)}
            onMouseDown={e => this.startDrag(e)}
            onMouseUp={e => this.stopDrag(e)}
            onMouseMove={e => this.drag(e)}
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
