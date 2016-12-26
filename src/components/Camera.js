import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as convnetActionBuilders from '../redux/actions/convnet';
import convnet from 'convnet';
import Promise from 'bluebird';

import { visualizeActivations } from '../utils/visual';

const persons = ['Nobody', 'Jens', 'Daria'];
const width = 64;
const height = 64;

class Camera extends Component {
  static propTypes = {
    convnetActions: PropTypes.object,
    nets: PropTypes.instanceOf(I.Map),
    trainers: PropTypes.instanceOf(I.Map),
  };

  constructor() {
    super();
    this.state = {
      training: false,
    };
  }
  componentWillMount() {
    this.createNetwork();
  }

  getUserMedia(opts, cb, cbErr) {
    if (!this.hasGetUserMedia()) return;
    const func = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
    func.call(navigator, opts, cb, cbErr);
  }

  getImage = (image) => {
    let source;
    let rect;
    if (image) {
      source = image;
      rect = {
        width: image.width,
        height: image.height,
      };
    } else {
      const video = this.refs.videoFeed;
      rect = video.getBoundingClientRect();
      source = this.refs.videoFeed;
    }
    const canvas = this.refs.capture;
    const ctx = canvas.getContext('2d');
    const dw = width * rect.height / rect.width;
    ctx.drawImage(source, (width - dw) / 2, 0, dw, height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const gray = [];
    for (let offset = 0; offset < data.data.length; offset += 4) {
      const red = data.data[offset];
      const green = data.data[offset + 1];
      const blue = data.data[offset + 2];
      gray.push((0.2989 * red + 0.5870 * green + 0.1140 * blue) / 255);
    }
    const vol = new convnet.Vol(width, height, 1, 0);
    vol.addFrom({ w: gray });
    return vol;
  };

  hasGetUserMedia() {
    return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
  }

  startCapture = () => {
    const options = {
      video: {
        mandatory: {
          maxWidth: width,
          maxHeight: height,
        },
      },
    };
    this.getUserMedia(options, localMediaStream => {
      this.setState({ error: null });

      const video = this.refs.videoFeed;
      video.src = window.URL.createObjectURL(localMediaStream);
    }, error => {
      this.setState({ error });
    });
  };

  createNetwork = () => {
    const { nets: { camera: net }, convnetActions } = this.props;
    if (net) return;

    const layerDefs = [];
    layerDefs.push({ type: 'input', out_sx: width, out_sy: height, out_depth: 1 });
    layerDefs.push({ type: 'conv', sx: 5, filters: 16, pad: 2, stride: 1, activation: 'relu' });
    layerDefs.push({ type: 'pool', sx: 2, stride: 2 });
    layerDefs.push({ type: 'conv', sx: 5, filters: 20, pad: 2, stride: 1, activation: 'relu' });
    layerDefs.push({ type: 'pool', sx: 2, stride: 2 });
    layerDefs.push({ type: 'softmax', num_classes: persons.length });
    convnetActions.addNet('camera', layerDefs);
    convnetActions.addTrainer('camera', {
      method: 'adadelta',
      l2_decay: 0.001,
      batch_size: 1,
    });
  };

  train = () => {
    const { nets: { camera: net }, trainers: { camera: trainer } } = this.props;

    this.setState({ training: 'Loading...' });
    const images = ['Angelina_Jolie_0001.jpg', 'Rick_Pitino_0001.jpg'];
    const image = new Image();
    Promise.mapSeries(images, (name, index) => {
      const promise = new Promise((resolve, reject) => {
        image.onload = () => {
          const data = this.getImage(image);
          this.setState({ training: `Loaded: ${index}` });
          resolve(data);
        };
        image.onerror = (err) => {
          this.setState({ training: `Error on ${index}: ${err.message}` });
          reject(err);
        };
        image.src = `/data/${name}`;
      });
      return promise;
    }).then(dataset => {
      let round = 100;
      const doTrain = () => {
        this.setState({ training: `Training: ${round}` });
        dataset.forEach((data, index) => trainer.train(data, index));
        // trainer.train(dataset[parseInt(Math.round(Math.random() * (dataset.length - 1)), 10)], 0);
        visualizeActivations(net, this.refs.visual);
        round--;
        if (round <= 0) {
          this.setState({ training: false });
          return;
        }
        window.setTimeout(doTrain, 0);
      };
      doTrain();
    }).catch(err => {
      console.log(err);
      this.setState({ training: false });
    });
  };

  trainPerson = (index) => {
    const { trainers: { camera: trainer } } = this.props;
    const image = this.getImage();
    trainer.train(image, index);
    this.forceUpdate();
  };

  refresh = () => {
    const { nets: { camera: net } } = this.props;

    visualizeActivations(net, this.refs.visual);
    this.forceUpdate();
  };

  render() {
    const { nets: { camera: net } } = this.props;
    const { training } = this.state;

    const result = net && net.forward(this.getImage());

    const trainButtons = persons.map((person, idx) => (
      <button key={person} onClick={ () => this.trainPerson(idx) }>{ `${person} (${(!result ? 0 : result.w[idx]).toFixed(3)})` }</button>
    ));
    const probs = persons.map((person, idx) => (
      <tr key={person}><td>{ person}</td><td>{(!result ? 0 : result.w[idx]).toFixed(3) }</td></tr>
    ));

    return (
      <div>
        <button onClick={ this.createNetwork }>Create Network</button>
        <button onClick={ this.train }>{ training || 'Train' }</button>
        <div>Camera feed</div>
        <button onClick={ this.startCapture }>Start Video</button>
        { trainButtons }
        <br />
        <video ref="videoFeed" autoPlay />
        <canvas ref="capture" width={width} height={height} />
        <br />
        <button onClick={ this.refresh }>Who Am I?</button>
        <table>
          <tbody>
            { probs }
          </tbody>
        </table>
        <div ref="visual"></div>
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
)(Camera);
