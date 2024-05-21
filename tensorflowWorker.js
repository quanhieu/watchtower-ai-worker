importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd');

let model;

self.onmessage = async function (e) {
  const { type, imageData, mirrored } = e.data;

  if (type === 'loadModel') {
    model = await cocoSsd.load({ base: 'mobilenet_v2' });
    self.postMessage({ type: 'modelLoaded' });
  }

  if (type === 'predict' && model) {
    const img = tf.browser.fromPixels(imageData);
    const predictions = await model.detect(img);

    self.postMessage({ type: 'predictions', predictions, mirrored });
  }
};
