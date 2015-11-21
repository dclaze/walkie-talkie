function WalkieTalkie() {
    this.captureContext = new AudioContext();
    this.currentCaptureStream = null;
    this.currentAudioInput = null;
    this.currentCaptureProcessorNode = null;

    this.paused = false;

    this.playbackContext = new AudioContext();
    this.bufferQueue = [];
    this.currentPlaybackBuffer = null;
}

WalkieTalkie.prototype.play = function(stream, streamInfo) {
    this.bufferQueue.push({
        stream: stream,
        streamInfo: streamInfo
    });
    this._tryProcessNextServerAudioBuffer();
};

WalkieTalkie.prototype._tryProcessNextServerAudioBuffer = function() {
    if (this.currentPlaybackBuffer != null)
        return;
    this._processNextServerAudioBuffer();
}

WalkieTalkie.prototype._processNextServerAudioBuffer = function() {
    var message = this.bufferQueue.shift(),
        self = this;
    if (message == null) {
        this.currentPlaybackBuffer = null;
    } else {
        var playbackBuffer = this.playbackContext.createBuffer(message.streamInfo.channels, message.stream.length, message.streamInfo.sampleRate);
        playbackBuffer.copyToChannel(new Float32Array(message.stream), 0, 0);
        this.currentPlaybackBuffer = this.playbackContext.createBufferSource();
        this.currentPlaybackBuffer.buffer = playbackBuffer;
        this.currentPlaybackBuffer.connect(this.playbackContext.destination);
        self._logVolume(message.stream, "out");
        this.currentPlaybackBuffer.onended = function() {
            self.currentPlaybackBuffer.disconnect();
            self._processNextServerAudioBuffer();
        };
        this.currentPlaybackBuffer.start();
    }
}

WalkieTalkie.prototype.turnOn = function(callback) {
    var self = this;
    navigator.getUserMedia({
        audio: true,
        video: false
    }, function(stream) {
        self._setupCapture(stream);
        callback(self);
    }, function(error) {
        alert(error);
    });
};

WalkieTalkie.prototype._setupCapture = function(stream) {
    var self = this;
    self.currentAudioInput = self.captureContext.createMediaStreamSource(stream);
    self.currentCaptureProcessorNode = self.captureContext.createScriptProcessor(8192, 1, 1);
    self.currentCaptureStream = stream;
    stream.onended = function() {
        self.currentAudioInput.disconnect();
        self.currentAudioInput = null;
        self.currentCaptureProcessorNode.disconnect();
        self.currentCaptureProcessorNode = null;
        self.currentCaptureStream = null;
    };
};

WalkieTalkie.prototype.turnOff = function(callback) {
    this.currentCaptureStream.getTracks().forEach(function(t) {
        t.stop();
    });
};

WalkieTalkie.prototype.startCapture = function(callback) {
    var self = this;
    self.paused = false;

    self.currentCaptureProcessorNode.onaudioprocess = function(e) {
        var buffer = e.inputBuffer.getChannelData(0);
        callback(Array.apply([], buffer), {
            sampleRate: self.captureContext.sampleRate,
            channels: 1
        });
        self._logVolume(buffer, "in");

        if (self.paused) {
            self.currentCaptureProcessorNode.disconnect(); //Wait to disconnect once the buffer has finished processing
        }
    };
    self.currentAudioInput.connect(self.currentCaptureProcessorNode);
    self.currentCaptureProcessorNode.connect(self.captureContext.destination);
};

WalkieTalkie.prototype.stopCapture = function() {
    this.paused = true;
    this.currentAudioInput.disconnect();
};

WalkieTalkie.prototype._logVolume = function(buffer, tag) {
    var sum = 0;

    for (var i = 0; i < buffer.length; i++) {
        var currentValue = buffer[i];
        sum += currentValue * currentValue;
    }
    var rms = Math.sqrt(sum / buffer.length);
    console.log(tag, rms);
};