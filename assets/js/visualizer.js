var visualizer;

document.addEventListener('DOMContentLoaded', function(e) {

  visualizer = new Visualizer();
  visualizer.initialize();
  visualizer.createBall();
  visualizer.setupAudioProcessing();
  visualizer.handleDrop();
  visualizer.handleKeyboard();

});

function Visualizer () {

    //Constant
    this.sphereRadius = 10;

    //Rendering
    this.camera;
    this.controls;
    this.renderer;
    this.scene;

    //Ball
    this.ball;

    //Audio
    this.amplitude = 1.8;
    this.analyser;
    this.audio;
    this.audioContext;
    this.noise;
    this.audioWorkletNode;
    this.sourceBuffer;

}

Visualizer.prototype.initialize = function () {

  // Setup audio to element
  this.audio = document.getElementById('sound');

  // Initialize simplex noise
  this.noise = new SimplexNoise();

  // Generate a three.js scene
  this.scene = new THREE.Scene();

  // Get the width and height
  var vw = window.innerWidth,
      vh = window.innerHeight;

  // Get the renderer
  this.renderer = new THREE.WebGLRenderer({antialias:true})
  this.renderer.setSize(vw,vh);

  // Add the renderer to the DOM
  document.body.insertBefore(this.renderer.domElement, document.querySelector('script'));

  // Create and add camera
  this.camera = new THREE.PerspectiveCamera(40, vw/vh, 0.1, 20000);
  this.camera.position.set(0, 45, 0);
  this.scene.add(this.camera);

  var that = this;

  window.addEventListener('resize', function(e) {

    var vw = window.innerWidth,
        vh = window.innerHeight;

    that.renderer.setSize(vw, vh);

    that.camera.aspect = vw/vh;
    that.camera.updateProjectMatrix();

  });

  // Background colour of the scene
  this.renderer.setClearColor(0xD9D6D2, 1);

  // Create a light and add it to the scene
  var light = new THREE.PointLight(0xFFFFFF);
  light.position.set(-100, 200, 100);
  this.scene.add(light);

  // Add interaction capabilities to the scene
  this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);

  // Render ball and loop it
  function renderLoop() {

    that.renderer.render(that.scene, that.camera);
    that.controls.update();
    requestAnimationFrame(renderLoop);

  }

  renderLoop();

};

Visualizer.prototype.createBall = function () {

  // Create and add the sphere
  var geometry = new THREE.SphereGeometry(this.sphereRadius, 30, 10, 0, Math.PI*2, 0, Math.PI*2);
  var material = new THREE.MeshBasicMaterial({color: 0xFFFF00, wireframe: false});
  this.ball = new THREE.Mesh(geometry, material);
  this.scene.add(this.ball);

};

Visualizer.prototype.averageInArray = function(array) {
  var total = array.reduce(function(sum, b) { return sum + b});
  return (total / array.length);
};

Visualizer.prototype.maxInArray = function(array) {
  return array.reduce(function(a, b) { return Math.max (a, b) });
};

Visualizer.prototype.fractionate = function(value, minValue, maxValue) {
  return (value - minValue)/(maxValue - minValue);
};

Visualizer.prototype.modulate = function(value, minValue, maxValue, outterMin, outterMax) {
  var fraction = this.fractionate(value, minValue, maxValue);
  var delta = outterMax - outterMin;
  return outterMin + (fraction * delta);
};

Visualizer.prototype.setupAudioProcessing = async function () {

  // Setup the audio context
  this.audioContext = new AudioContext();
  await this.audioContext.audioWorklet.addModule('/assets/js/audio-processor.js');

  // Create an AudioWorkletNode
  this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

  // Create the source buffer
  this.sourceBuffer = this.audioContext.createMediaElementSource(this.audio);

  // Create the analyser node
  this.analyser = this.audioContext.createAnalyser();
  this.analyser.smoothingTimeConstant = 0.3;
  this.analyser.fftSize = 512;

  // Connect source to analyser
  this.sourceBuffer.connect(this.analyser);

  // Then, the analyser to speakers
  this.analyser.connect(this.audioContext.destination);

  // Connect source to analyser
  this.sourceBuffer.connect(this.audioContext.destination);

  var that = this

  // Update ball radius
  function updateVisualization() {

    // Get the average for the first channel
    var array = new Uint8Array(that.analyser.frequencyBinCount);
    that.analyser.getByteFrequencyData(array);

    // Split the frequency between bass and treble
    var bassArray = array.slice(0, (array.length/2) -1),
        trebleArray = array.slice((array.length/2) -1, array.length -1);

    // Compute
    var lowerMaxFrequency = that.averageInArray(bassArray) / bassArray.length,
        upperAverageFrequency = that.averageInArray(trebleArray) / trebleArray.length;

    // Compute the bass and treble frequencies
    var bassFrequency = that.modulate(Math.pow(lowerMaxFrequency, 0.5), 0, 1, 0, 8),
        trebleFrequency = that.modulate(upperAverageFrequency, 0, 1, 0, 4);

    // Render the scene and update controls
    visualizer.renderer.render(visualizer.scene, visualizer.camera);
    visualizer.controls.update();

    visualizer.ball.geometry.vertices.forEach(function(vertex, i) {

      var offset = visualizer.ball.geometry.parameters.radius;
      vertex.normalize();

      var distance = (offset + bassFrequency) + that.noise.noise3D(vertex.x, vertex.y, vertex.z) * that.amplitude * trebleFrequency;
      vertex.multiplyScalar(distance);

    });

    visualizer.ball.geometry.verticesNeedUpdate = true;
    visualizer.ball.geometry.normalsNeedUpdate = true;
    visualizer.ball.geometry.computeVertexNormals();
    visualizer.ball.geometry.computeFaceNormals();

    requestAnimationFrame(updateVisualization);

  };

  updateVisualization();

};

Visualizer.prototype.start = function (file) {

  // Set audio source
  this.audio.src = URL.createObjectURL(file);

  var label = document.getElementById('guide')

  // Load audio
  label.innerHTML = 'Loading';
  this.audio.load();

  // Play audio
  this.audio.play();

  // Place file name on label
  var fileName = file.name.substring(0, file.name.length - 4);
  label.innerHTML = fileName;

};

Visualizer.prototype.handleDrop = function () {

  document.body.addEventListener('dragover', function(e) {

    // Stop even from bubbling outside
    e.stopPropagation;

    // Stop from doing the normal reaction to event
    e.preventDefault();

    // Copy the audio to a new location
    e.dataTransfer.dropEffect = 'copy';

  }, false);

  document.body.addEventListener('drop', function(e) {

    // Stop even from bubbling outside
    e.stopPropagation;

    // Stop from doing the normal reaction to event
    e.preventDefault();

    // Get the file
    var file = e.dataTransfer.files[0];

    // Load the file
    visualizer.audioContext.resume();
    visualizer.start(file);

  }, false);

};

Visualizer.prototype.handleKeyboard = function () {

  document.body.addEventListener('keydown', function(e) {

    // Check if it's the space bar
    if (e.keyCode == 32) {

      // Toggle audio
      if (visualizer.audio.paused && !this.audio)
        visualizer.audio.play();
      else
        visualizer.audio.pause();

    }

  }, false);

};
