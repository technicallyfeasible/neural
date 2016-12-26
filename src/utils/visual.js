import cnnutil from 'convnet/src/util';

/**
 * @param elt - elt is the element to add all the canvas activation drawings into
 * @param A - A is the Vol() to use
 * @param scale - scale is a multiplier to make the visualizations larger. Make higher for larger pictures
 * @param grads - if grads is true then gradients are used instead
 */
function drawActivations(elt, A, scale, grads) {
  const s = scale || 2; // scale
  let drawGrads = false;
  if (typeof(grads) !== 'undefined') drawGrads = grads;

  // get max and min activation to scale the maps automatically
  const w = drawGrads ? A.dw : A.w;
  const mm = cnnutil.maxmin(w);

  // create the canvas elements, draw and add to DOM
  for (let d = 0; d < A.depth; d++) {
    const canv = document.createElement('canvas');
    canv.className = 'actmap';
    const W = A.sx * s;
    const H = A.sy * s;
    canv.width = W;
    canv.height = H;
    const ctx = canv.getContext('2d');
    const g = ctx.createImageData(W, H);

    for (let x = 0; x < A.sx; x++) {
      for (let y = 0; y < A.sy; y++) {
        let dval;
        if (drawGrads) {
          dval = Math.floor((A.get_grad(x, y, d) - mm.minv) / mm.dv * 255);
        } else {
          dval = Math.floor((A.get(x, y, d) - mm.minv) / mm.dv * 255);
        }
        for (let dx = 0; dx < s; dx++) {
          for (let dy = 0; dy < s; dy++) {
            const pp = ((W * (y * s + dy)) + (dx + x * s)) * 4;
            for (let i = 0; i < 3; i++) {
              g.data[pp + i] = dval;
            } // rgb
            g.data[pp + 3] = 255; // alpha channel
          }
        }
      }
    }
    ctx.putImageData(g, 0, 0);
    elt.appendChild(canv);
  }
}

function drawActivationsColor(elt, A, scale, grads) {
  const s = scale || 2; // scale
  let drawGrads = false;
  if (typeof(grads) !== 'undefined') drawGrads = grads;

  // get max and min activation to scale the maps automatically
  const w = drawGrads ? A.dw : A.w;
  const mm = cnnutil.maxmin(w);

  const canv = document.createElement('canvas');
  canv.className = 'actmap';
  const W = A.sx * s;
  const H = A.sy * s;
  canv.width = W;
  canv.height = H;
  const ctx = canv.getContext('2d');
  const g = ctx.createImageData(W, H);
  for (let d = 0; d < 3; d++) {
    for (let x = 0; x < A.sx; x++) {
      for (let y = 0; y < A.sy; y++) {
        let dval;
        if (drawGrads) {
          dval = Math.floor((A.get_grad(x, y, d) - mm.minv) / mm.dv * 255);
        } else {
          dval = Math.floor((A.get(x, y, d) - mm.minv) / mm.dv * 255);
        }
        for (let dx = 0; dx < s; dx++) {
          for (let dy = 0; dy < s; dy++) {
            const pp = ((W * (y * s + dy)) + (dx + x * s)) * 4;
            g.data[pp + d] = dval;
            if (d === 0) g.data[pp + 3] = 255; // alpha channel
          }
        }
      }
    }
  }
  ctx.putImageData(g, 0, 0);
  elt.appendChild(canv);
}

function visualizeActivations(net, element) {
  // clear the element
  const elt = element;
  elt.innerHTML = '';

  // show activations in each layer
  const N = net.layers.length;
  for (let i = 0; i < N; i++) {
    const L = net.layers[i];

    const layerDiv = document.createElement('div');

    // visualize activations
    const activationsDiv = document.createElement('div');
    activationsDiv.appendChild(document.createTextNode('Activations:'));
    activationsDiv.appendChild(document.createElement('br'));
    activationsDiv.className = 'layer_act';
    let scale = 2;
    if (L.layer_type === 'softmax' || L.layer_type === 'fc') scale = 10; // for softmax

    // HACK to draw in color in input layer
    if (i === 0) {
      drawActivationsColor(activationsDiv, L.out_act, scale);
      drawActivationsColor(activationsDiv, L.out_act, scale, true);

      /*
       // visualize positive and negative components of the gradient separately
       const dd = L.out_act.clone();
       const ni = L.out_act.w.length;
       for(const q=0;q<ni;q++) { const dwq = L.out_act.dw[q]; dd.w[q] = dwq > 0 ? dwq : 0.0; }
       draw_activations_COLOR(activations_div, dd, scale);
       for(const q=0;q<ni;q++) { const dwq = L.out_act.dw[q]; dd.w[q] = dwq < 0 ? -dwq : 0.0; }
       draw_activations_COLOR(activations_div, dd, scale);
       */

      /*
       // visualize what the network would like the image to look like more
       const dd = L.out_act.clone();
       const ni = L.out_act.w.length;
       for(const q=0;q<ni;q++) { const dwq = L.out_act.dw[q]; dd.w[q] -= 20*dwq; }
       draw_activations_COLOR(activations_div, dd, scale);
       */

      /*
       // visualize gradient magnitude
       const dd = L.out_act.clone();
       const ni = L.out_act.w.length;
       for(const q=0;q<ni;q++) { const dwq = L.out_act.dw[q]; dd.w[q] = dwq*dwq; }
       draw_activations_COLOR(activations_div, dd, scale);
       */
    } else {
      drawActivations(activationsDiv, L.out_act, scale);
    }

    // visualize data gradients
    if (L.layer_type !== 'softmax' && L.layer_type !== 'input') {
      const gradDiv = document.createElement('div');
      gradDiv.appendChild(document.createTextNode('Activation Gradients:'));
      gradDiv.appendChild(document.createElement('br'));
      gradDiv.className = 'layer_grad';
      scale = 2;
      if (L.layer_type === 'softmax' || L.layer_type === 'fc') scale = 10; // for softmax
      drawActivations(gradDiv, L.out_act, scale, true);
      activationsDiv.appendChild(gradDiv);
    }

    // visualize filters if they are of reasonable size
    if (L.layer_type === 'conv') {
      const filtersDiv = document.createElement('div');
      if (L.filters[0].sx > 3) {
        // actual weights
        filtersDiv.appendChild(document.createTextNode('Weights:'));
        filtersDiv.appendChild(document.createElement('br'));
        for (let j = 0; j < L.filters.length; j++) {
          // HACK to draw in color for first layer conv filters
          if (i === 1) {
            drawActivationsColor(filtersDiv, L.filters[j], 2);
          } else {
            filtersDiv.appendChild(document.createTextNode('('));
            drawActivations(filtersDiv, L.filters[j], 2);
            filtersDiv.appendChild(document.createTextNode(')'));
          }
        }
        // gradients
        filtersDiv.appendChild(document.createElement('br'));
        filtersDiv.appendChild(document.createTextNode('Weight Gradients:'));
        filtersDiv.appendChild(document.createElement('br'));
        for (let j = 0; j < L.filters.length; j++) {
          if (i === 1) {
            drawActivationsColor(filtersDiv, L.filters[j], 2, true);
          } else {
            filtersDiv.appendChild(document.createTextNode('('));
            drawActivations(filtersDiv, L.filters[j], 2, true);
            filtersDiv.appendChild(document.createTextNode(')'));
          }
        }
      } else {
        filtersDiv.appendChild(document.createTextNode('Weights hidden, too small'));
      }
      activationsDiv.appendChild(filtersDiv);
    }
    layerDiv.appendChild(activationsDiv);

    // print some stats on left of the layer
    layerDiv.className = `layer lt${L.layer_type}`;
    const titleDiv = document.createElement('div');
    titleDiv.className = 'ltitle';
    let t = `${L.layer_type} (${L.out_sx}x${L.out_sy}x${L.out_depth})`;
    titleDiv.appendChild(document.createTextNode(t));
    layerDiv.appendChild(titleDiv);

    if (L.layer_type === 'conv') {
      t = `filter size ${L.filters[0].sx}x${L.filters[0].sy}x${L.filters[0].depth}, stride ${L.stride}`;
      layerDiv.appendChild(document.createTextNode(t));
      layerDiv.appendChild(document.createElement('br'));
    }
    if (L.layer_type === 'pool') {
      t = `pooling size ${L.sx}x${L.sy}, stride ${L.stride}`;
      layerDiv.appendChild(document.createTextNode(t));
      layerDiv.appendChild(document.createElement('br'));
    }

    // find min, max activations and display them
    let mma = cnnutil.maxmin(L.out_act.w);
    t = `max activation: ${cnnutil.f2t(mma.maxv)}, min: ${cnnutil.f2t(mma.minv)}`;
    layerDiv.appendChild(document.createTextNode(t));
    layerDiv.appendChild(document.createElement('br'));

    mma = cnnutil.maxmin(L.out_act.dw);
    t = `max gradient: ${cnnutil.f2t(mma.maxv)}, min: ${cnnutil.f2t(mma.minv)}`;
    layerDiv.appendChild(document.createTextNode(t));
    layerDiv.appendChild(document.createElement('br'));

    // number of parameters
    if (L.layer_type === 'conv' || L.layer_type === 'local') {
      const totParams = L.sx * L.sy * L.in_depth * L.filters.length + L.filters.length;
      t = `parameters: ${L.filters.length}x${L.sx}x${L.sy}x${L.in_depth}+${L.filters.length} = ${totParams}`;
      layerDiv.appendChild(document.createTextNode(t));
      layerDiv.appendChild(document.createElement('br'));
    }
    if (L.layer_type === 'fc') {
      const totParams = L.num_inputs * L.filters.length + L.filters.length;
      t = `parameters: ${L.filters.length}x${L.num_inputs}+${L.filters.length} = ${totParams}`;
      layerDiv.appendChild(document.createTextNode(t));
      layerDiv.appendChild(document.createElement('br'));
    }

    // css madness needed here...
    const clear = document.createElement('div');
    clear.className = 'clear';
    layerDiv.appendChild(clear);

    elt.appendChild(layerDiv);
  }
}

export {
  visualizeActivations,
};
