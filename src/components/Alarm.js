import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import pad from 'pad';
import * as convnetActionBuilders from '../redux/actions/convnet';
import convnet from 'convnet';

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

class Alarm extends Component {
  static propTypes = {
    convnetActions: PropTypes.object,
    nets: PropTypes.instanceOf(I.Map),
    trainers: PropTypes.instanceOf(I.Map),
  };

  constructor() {
    super();
    this.state = {
      time: '22:00',
      weekday: 0,
    };
  }

  componentWillMount() {
    this.createNetwork();
  }

  componentDidUpdate = () => {
    const { nets: { alarm: net } } = this.props;
    const { weekday } = this.state;
    if (!net || weekday < 0) return;

    const canvas = this.refs.chart;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    for (let time = 0; time < 24; time ++) {
      if ([6, 12, 18].indexOf(time) !== -1) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      } else {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      }
      const x = time * width / 24;
      const y = time * height / 24;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const image = ctx.getImageData(0, 0, width, height);

    for (let x = 0; x < width; x++) {
      const input = [x / width].concat(weekdays.map((day, i) => (i === weekday ? 1 : 0)));
      const result = net.forward(new convnet.Vol(input)).w[0];
      if (result < 0 || result > 1) continue;
      const y = height - parseInt(result * height, 10);
      const offset = (y * width + x) * 4;
      image.data[offset] = 255;
      image.data[offset + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  };

  /**
   * Build time between 0-1
   * @param time {string}
   * @returns {number}
   */
  getTime(time) {
    const parts = (time || '').split(':');
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;
    return (hours * 3600 + minutes * 60 + seconds) / 86400;
  }

  displayTime(time) {
    if (time < 0 || time > 1.0) return 'INVALID';
    const seconds = parseInt(time * 86400, 10);
    let minutes = parseInt(seconds / 60, 10);
    // seconds -= minutes * 60;
    const hours = parseInt(minutes / 60, 10);
    minutes -= hours * 60;
    return `${pad(2, hours.toFixed(0), '0')}:${pad(2, minutes.toFixed(0), '0')}`;
  }

  createNetwork = () => {
    const { nets: { alarm: net }, convnetActions } = this.props;
    if (net) return;

    const layerDefs = [];
    // inputs: sleeptime, monday, tuesday, wednesday, thursday, friday, saturday, sunday
    layerDefs.push({ type: 'input', out_sx: 1, out_sy: 1, out_depth: 1 + weekdays.length });
    layerDefs.push({ type: 'fc', num_neurons: 5, activation: 'sigmoid' });
    layerDefs.push({ type: 'regression', num_neurons: 1 });
    convnetActions.addNet('alarm', layerDefs);
    convnetActions.addTrainer('alarm', {
      method: 'adadelta',
      l2_decay: 0.001,
      learning_rate: 0.01,
      batch_size: 1,
    });
  };

  train = () => {
    const { trainers: { alarm: trainer } } = this.props;
    const set = [
      // Monday, 30/05/2016
      [this.getTime('23:04'), 1, 0, 0, 0, 0, 0, 0, this.getTime('7:50')],
      [this.getTime('23:43'), 0, 0, 0, 0, 0, 0, 1, this.getTime('8:37')],
      [this.getTime('22:59'), 0, 0, 0, 0, 0, 1, 0, this.getTime('6:32')],
      [this.getTime('00:22'), 0, 0, 0, 0, 1, 0, 0, this.getTime('7:03')],
      [this.getTime('00:50'), 0, 0, 0, 1, 0, 0, 0, this.getTime('7:17')],
      [this.getTime('23:29'), 0, 0, 1, 0, 0, 0, 0, this.getTime('6:36')],
      [this.getTime('23:50'), 0, 1, 0, 0, 0, 0, 0, this.getTime('6:23')],
      [this.getTime('23:08'), 1, 0, 0, 0, 0, 0, 0, this.getTime('6:10')],
      [this.getTime('23:19'), 0, 0, 0, 0, 0, 0, 1, this.getTime('6:42')],
      [this.getTime('23:07'), 0, 0, 0, 0, 0, 1, 0, this.getTime('6:19')],
      [this.getTime('23:12'), 0, 0, 0, 0, 1, 0, 0, this.getTime('7:42')],
      [this.getTime('00:26'), 0, 0, 0, 1, 0, 0, 0, this.getTime('8:17')],
      [this.getTime('23:21'), 0, 0, 1, 0, 0, 0, 0, this.getTime('7:11')],
      [this.getTime('23:56'), 0, 1, 0, 0, 0, 0, 0, this.getTime('7:45')],
      // Monday, 16/05/2016
      [this.getTime('01:08'), 1, 0, 0, 0, 0, 0, 0, this.getTime('9:41')],
      [this.getTime('02:56'), 0, 0, 0, 0, 0, 0, 1, this.getTime('9:44')],
      [this.getTime('01:50'), 0, 0, 0, 0, 0, 1, 0, this.getTime('9:00')],
      [this.getTime('23:44'), 0, 0, 0, 0, 1, 0, 0, this.getTime('6:21')],
      [this.getTime('23:33'), 0, 0, 0, 1, 0, 0, 0, this.getTime('6:08')],
      [this.getTime('23:11'), 0, 0, 1, 0, 0, 0, 0, this.getTime('6:13')],
      [this.getTime('22:39'), 0, 1, 0, 0, 0, 0, 0, this.getTime('6:10')],
      // Monday, 09/05/2016
      [this.getTime('23:52'), 1, 0, 0, 0, 0, 0, 0, this.getTime('6:18')],
      [this.getTime('00:16'), 0, 0, 0, 0, 0, 0, 1, this.getTime('7:57')],
      [this.getTime('23:14'), 0, 0, 0, 0, 0, 1, 0, this.getTime('6:31')],
      [this.getTime('22:56'), 0, 0, 0, 0, 1, 0, 0, this.getTime('6:10')],
      [this.getTime('23:38'), 0, 0, 0, 1, 0, 0, 0, this.getTime('6:30')],
      [this.getTime('23:39'), 0, 0, 1, 0, 0, 0, 0, this.getTime('6:12')],
      [this.getTime('22:11'), 0, 1, 0, 0, 0, 0, 0, this.getTime('6:00')],
      // Monday, 02/05/2016
      [this.getTime('01:37'), 1, 0, 0, 0, 0, 0, 0, this.getTime('7:37')],
    ];
    // generate random times for all days with the target sleep duration
    const randomEntries = 1000;
    const minTime = 21 * 3600;    // earliest to bed
    const toBedRange = 5 * 3600;  // total range of to-bed times
    const sleepHours = 7.5;       // target number of hours for sleep
    const targetTime = 6 * 3600 + 10 * 60;       // target wakeup time
    const latestTime = 7 * 3600 + 30 * 60;       // latest wakeup time
    for (let i = 0; i < randomEntries; i++) {
      let time = minTime + Math.random() * toBedRange;
      if (time > 86400) time -= 86400;
      let uptime = time + sleepHours * 3600;
      if (uptime > 86400) uptime -= 86400;
      if (uptime < targetTime) uptime = targetTime;
      if (uptime > latestTime) uptime = latestTime;
      const weekday = 0; // Math.round(Math.random() * 6);
      const input = [time / 86400].concat(weekdays.map((day, index) => (index === weekday ? 1 : 0)));
      input.push(uptime / 86400);
      set.push(input);
      console.log(`${parseInt(input[0] * 24, 10)}:${parseInt((input[0] * 24 * 60) % 60, 10)}`, input[input.length - 1] * 24);
    }
    // train network with set data
    set.forEach(row => {
      const value = new convnet.Vol(row.slice(0, row.length - 1));
      trainer.train(value, [row[row.length - 1]]);
    });
    this.forceUpdate();
  };

  handleSelectWeekday = (e) => {
    this.setState({ weekday: parseInt(e.target.value, 10) });
  };

  handleSetTime = (e) => {
    this.setState({ time: e.target.value });
  };

  render() {
    const { nets: { alarm: net } } = this.props;
    const { weekday, time } = this.state;

    const input = [this.getTime(time)].concat(weekdays.map((day, i) => (i === weekday ? 1 : 0)));
    const result = net && net.forward(new convnet.Vol(input));

    return (
      <div>
        <button onClick={ this.createNetwork }>Create Network</button>
        <button onClick={ this.train }>Train</button>
        <div>Time to bed</div>
        <input type="text" value={time} onChange={this.handleSetTime} />
        <div>Tomorrow is</div>
        <select value={weekday} onChange={this.handleSelectWeekday}>
          <option value={-1} />
          { weekdays.map((day, i) => <option key={day} value={i}>{ day }</option>) }
        </select>
        <div>You need to wake up at</div>
        <div>{ this.displayTime(result && result.w[0]) }</div>
        <canvas ref="chart" width="400" height="400" style={{ border: '1px solid #666' }} /><br />
        <textarea style={{ width: 400, height: 400 }} value={JSON.stringify(net.toJSON(), null, 2)} />
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
)(Alarm);
