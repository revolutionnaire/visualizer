class AudioProcessor extends AudioWorkletProcessor {

  process(inputs, outputs, parameters) {
    // Simple pass-through processor (no actual processing)
    return true;
  }

}

registerProcessor('audio-processor', AudioProcessor);
