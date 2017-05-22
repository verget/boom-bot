
const GIFEncoder = require('gifencoder');
const Canvas = require('canvas');
const fs = require('fs');

class AnimationService {
  
  constructor() {
    let encoder = new GIFEncoder(320, 240);
// stream the results as they are available into myanimated.gif
    encoder.createReadStream().pipe(fs.createWriteStream('myanimated.gif'));
  
    encoder.start();
    encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
    encoder.setDelay(500);  // frame delay in ms
    encoder.setQuality(10); // image quality. 10 is default.

// use node-canvas
    let canvas = new Canvas(320, 240);
    let ctx = canvas.getContext('2d');

// red rectangle
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 320, 240);
    encoder.addFrame(ctx);

// green rectangle
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, 320, 240);
    encoder.addFrame(ctx);

// blue rectangle
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(0, 0, 320, 240);
    encoder.addFrame(ctx);
  
    encoder.finish();
  }
  
}
module.exports = new AnimationService();
