// See the following for more up-to-date instructions
// some deprecations and compatibility for older browsers
// https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

(function() {

const sensibleChange = 1715;

const streamOpts = {
    "audio": {
	"mandatory": {
	    "echoCancellation": "false",
	    "googAutoGainControl": "false",
	    "googNoiseSuppression": "true",
  	    "googHighpassFilter": "true"
	},
	"optional": [
	    { "autoGainControl": "false" },
	    { "noiseSuppression": "false" },
  	    { "highpassFilter": "true" }
	]
    }
};

var audioContext = new AudioContext();
    analyser = null;

const MAX_SIZE = Math.max(4,Math.floor(audioContext.sampleRate/5000));    // corresponds to a 5kHz signal

var rafID = null;
var buf = new Float32Array(1024);

function Microphone() {
    this.tone = undefined;
    this.mediaStreamSource = null;
    this.pitchBuffer = [];
    this.mightStillBeNoise = 3;
}

Microphone.prototype.resetNoiseDetection = function(pitch) {
    this.pitchBuffer = [pitch];
    this.mightStillBeNoise = 3;
}

Microphone.prototype.noiseLessLikely = function(pitch) {
    this.mightStillBeNoise--;
}

Microphone.prototype.enable = function() {
    if (!window.cancelAnimationFrame)
	window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
    window.cancelAnimationFrame( rafID );
    if(!!navigator.mediaDevices) {
	navigator.mediaDevices.getUserMedia(streamOpts)
	    .then(this.onMicAudioSuccess)
	    .catch(console.error);
    } else {
	console.warn('Browser does not support getUserMedia promise, reverting to callbacks');
	audio.getUserMedia(streamOpts, this.onMicAudioSuccess);
    }
}

Microphone.prototype.smoothPitch  = function(pitch) {
    let buff = this.pitchBuffer; // don't confuse with global buf
    buff.push(pitch);
    if(buff.length > 3) buff.shift();

    if(buff.length === 1) return pitch;
    else if(buff.length == 3) {
	buff[buff.length-1] = (buff[0]+buff[1]+buff[2])/3.0;
	return buff[buff.length-1];
    } else return buff.reduce((a,b)=>a+b) / buff.length; // assume 2, but be safe
}

Microphone.prototype.onMicAudioSuccess = function(stream) {
    console.log('got the mic!');
    // Create an AudioNode from the stream.
    this.mediaStreamSource = audioContext.createMediaStreamSource(stream);

    // Connect it to the destination.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    this.mediaStreamSource.connect( analyser );
    updatePitch();
}

// I may be able to move my pitchBuffer noise/smoothing into existing structure
function updatePitch() {
    analyser.getFloatTimeDomainData( buf );
    var pitch = audio.autoCorrelate( buf, audioContext.sampleRate );

    let pb = mic.pitchBuffer,
        pl = pb.length,
        prevPitch = !! pl ? pb[pl-1] : 0;

    // pitch was garbled, or inhuman
    if(pitch == -1 || pitch > 4700) // world record is 4186
	pitch = prevPitch;

    // an abrupt change just be noise
    // we give a grace period of 3 samples
    // meanwhile feed them the last detected pitch
    // improvement: calculate where their voice is going
    let abrupt = Math.abs(prevPitch-pitch) > sensibleChange;
    if(abrupt) {
	if(mic.mightStillBeNoise) {
	    mic.noiseLessLikely();
	    pitch = prevPitch; // assume no change
	} else mic.resetNoiseDetection(pitch);
    }

    pitch = mic.smoothPitch(pitch);


    handlePitch(pitch);

    if (!window.requestAnimationFrame)
	window.requestAnimationFrame = window.webkitRequestAnimationFrame;
    rafID = window.requestAnimationFrame( updatePitch );

}

window.Microphone = Microphone;
})();
