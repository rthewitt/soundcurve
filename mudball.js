// instead of whistling
const INITIAL_SPEED = 2;

var doSing = false;
var DELTA_X = INITIAL_SPEED;
// will correct octave for singing
function heightFromPitch(p) {
    if(doSing) {
	// not 2 octaves, not same notes...
	//return 700+400*(Math.log(p/440.0)/Math.log(2));

	// NOT EQUIVALENT TO THE 2nd WHISTLE TRANSLATION, ONLY APPROXIMATE
	return 472+200*(Math.log(p/440.0)/Math.log(2));
    } else {
	//return -300+400*(Math.log(p/440.0)/Math.log(2));
	return -100+200*(Math.log(p/440.0)/Math.log(2));
    }
}
var accuracy = 20; // crosshair should shrink as we get more accurate

const START_X = 250;
const END_X = 750;
const START_OPTIONS_X = END_X+1;
const END_OPTIONS_X = 950;
const OPTIONS_Y = 100;


var curve;
function getCurveStartX() {
    return curve.controls[0][0];
}
function getCurveStartY() {
    // TODO generic!!
    return curve.controls[6][0];
}

function getStartX() {
    return getCurveStartX() - 55*DELTA_X;
}

function toggleSing() {
    doSing = !doSing;
}
    

// ===========================
// WEB AUDIO API AND FUNCTIONS
// ===========================

var channel_max = 32;										// number of channels
audioChannels = new Array();

// used as const, was variable in float version of autoCorrelate
const MIN_SAMPLES = 0;  // will be initialized when AudioContext is created.
const GOOD_ENOUGH_CORRELATION = 0.9; // this is the "bar" for how close a correlation needs to be

for (var a=0;a<channel_max;a++) {									// prepare the channels
    audioChannels[a] = new Array();
    audioChannels[a]['channel'] = new Audio();						// create a new audio object
    audioChannels[a]['finished'] = -1;							// expected end time for this channel
    audioChannels[a]['keyvalue'] = '';
}


// To be used with Whistle business
function getUserMedia(opts, callback) {
    try {
	navigator.getUserMedia =
	    navigator.getUserMedia ||
	    navigator.webkitGetUserMedia ||
	    navigator.mozGetUserMedia;
	navigator.getUserMedia(opts, callback, e => console.log('error getting stream'));
    } catch (e) {
	alert('getUserMedia threw exception :' + e);
    }
}


// Why is this in underscore notation?
// TODO answer questions
// 1) when do I want multisound vs MIDI play?
// 2) can WebAudio listen to MIDI Api to avoid low-level play?
function play_multi_sound(s) {
    for (var a=0; a < audioChannels.length; a++) { 
	var now = new Date(); 
	if(audioChannels[a]['finished'] < now.getTime()) { // is this channel finished?

	    try {		
		audioChannels[a]['finished'] = now.getTime() + 1000;
		audioChannels[a]['channel'] = document.getElementById(s);
		audioChannels[a]['channel'].currentTime = 0;
		audioChannels[a]['channel'].volume=1;
		audioChannels[a]['channel'].play();
		audioChannels[a]['keyvalue'] = s; 
	    } catch(v) {
		console.log(v.message); 
	    }
	    break;
	}
    }
}


function channelStop(idx, when, dropVolume) {
    if(dropVolume) audioChannels[a]['channel'].volume=0;
    setTimeout(function() {
	try {
	    audioChannels[idx]['channel'].pause()
	    audioChannels[idx]['channel'].currentTime = 0;
	} catch(ex) { console.log(ex); }
    }, when);
}

function stop_multi_sound(s, sender) { 
    for (var a=0; a < audioChannels.length; a++) { 
	if (audioChannels[a]['keyvalue'] == s) { // is this channel finished?
	    try { 
		audioChannels[a]['channel'] = document.getElementById(s);
		var wasMouse = sender != undefined && sender == 'mouse';
		channelStop(a, wasMouse ? 2500 : 500, wasMouse);
	    } catch(v) {	
		console.log(v.message); 
	    }
	    break;
	}
    }
}

// is there a better algorithm?  Is this fft?
function autoCorrelate( buf, sampleRate ) {
    var SIZE = buf.length;
    var MAX_SAMPLES = Math.floor(SIZE/2);
    var best_offset = -1;
    var best_correlation = 0;
    var rms = 0;
    var foundGoodCorrelation = false;
    var correlations = new Array(MAX_SAMPLES);

    for (var i=0;i<SIZE;i++) {
	var val = buf[i];
	rms += val*val;
    }
    rms = Math.sqrt(rms/SIZE);
    if (rms<0.01) // not enough signal
	return -1;

    var lastCorrelation=1;
    for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
	var correlation = 0;

	for (var i=0; i<MAX_SAMPLES; i++) {
	    correlation += Math.abs((buf[i])-(buf[i+offset]));
	}
	correlation = 1 - (correlation/MAX_SAMPLES);
	correlations[offset] = correlation; // store it, for the tweaking we need to do below.
	if ((correlation>GOOD_ENOUGH_CORRELATION) && (correlation > lastCorrelation)) {
	    foundGoodCorrelation = true;
	    if (correlation > best_correlation) {
		best_correlation = correlation;
		best_offset = offset;
	    }
	} else if (foundGoodCorrelation) {
	    // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
	    // Now we need to tweak the offset - by interpolating between the values to the left and right of the
	    // best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
	    // we need to do a curve fit on correlations[] around best_offset in order to better determine precise
	    // (anti-aliased) offset.

	    // we know best_offset >=1, 
	    // since foundGoodCorrelation cannot go to true until the second pass (offset=1), and 
	    // we can't drop into this clause until the following pass (else if).
	    var shift = (correlations[best_offset+1] - correlations[best_offset-1])/correlations[best_offset];
	    return sampleRate/(best_offset+(8*shift));
	}
	lastCorrelation = correlation;
    }
    if (best_correlation > 0.01) {
	// console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
	return sampleRate/best_offset;
    }
    return -1;
//  var best_frequency = sampleRate/best_offset;
}

function noteFromPitch( frequency ) {
    var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
    return Math.round( noteNum ) + 69;
}

function frequencyFromNoteNumber( note ) {
    return 440 * Math.pow(2,(note-69)/12);
}

function centsOffFromPitch( frequency, note ) {
    return Math.floor( 1200 * Math.log( frequency / frequencyFromNoteNumber( note ))/Math.log(2) );
}


var audio = {
    playSound: play_multi_sound,
    stopSound: stop_multi_sound,
    getUserMedia: getUserMedia,
    noteFromPitch: noteFromPitch,
    frequencyFromNoteNumber: frequencyFromNoteNumber,
    centsOffFromPitch: centsOffFromPitch,
    autoCorrelate: autoCorrelate
}

// ================= END AUDIO ==============
// ================= BEGIN MICROPHONE =======

const streamOpts = {
    "audio": {
	"mandatory": {
	    "googEchoCancellation": "false",
	    "googAutoGainControl": "false",
	    "googNoiseSuppression": "false",
	    "googHighpassFilter": "false"
	},
	"optional": []
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
}

// will pass this in

Microphone.prototype.enable = function() {
    if (!window.cancelAnimationFrame)
	window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
    window.cancelAnimationFrame( rafID );
    audio.getUserMedia(streamOpts, this.onMicAudioSuccess);
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



var mic = new Microphone;



let x = p => p[0];
let y = p => p[1];
let offset = (x,y) => p => [ p[0]+x, p[1]+y ];

let M7 = [[1,   0,   0,  0,  0,  0,  0],
	  [-6,  6,   0,  0,  0,  0,  0],
	  [15, -30, 15,  0,  0,  0,  0],
	  [-20, 60, -60,20,  0,  0,  0],
	  [15, -60, 90, -60, 15, 0,  0],
	  [-6,  30, -60, 60, -30, 6, 0],
	  [1,   -6, 15, -20, 15, -6, 1]];

function range(n,m) {
    var nums = [];
    for(var i=n; i<m; i++)
        nums.push(i);
    return nums;
}

function bez7(t,ws) {
    let mt = 1-t;
    let p = Math.pow;
    return ws[0]*p(mt,6) + 6*ws[1]*p(mt,5)*t + 15*ws[2]*p(mt,4)*p(t,2) +
	20*ws[3]*p(mt,3)*p(t,3) + 15*ws[4]*p(mt,2)*p(t,4)+6*ws[5]*mt*p(t,5) +
	ws[6]*p(t,6);
}


// copied this from linear algebra dependency of bezier primer
function transpose(M) {
  var Mt = [];
  M.forEach(row => Mt.push([]));
  M.forEach((row,r) => row.forEach((v,c) => Mt[c][r] = v));
  return Mt;
}

// copied this from linear algebra dependency of bezier primer
function row(M,i) {
  return M[i];
}

// copied this from linear algebra dependency of bezier primer
function col(M,i) {
  var col = [];
  for(var r=0, l=M.length; r<l; r++) {
    col.push(M[r][i]);
  }
  return col;
}

// copied this from linear algebra dependency of bezier primer
function multiply(M1, M2) {
  // prep
  var M = [];
  var dims = [M1.length, M1[0].length, M2.length, M2[0].length];
  // work
  for (var r=0, c; r<dims[0]; r++) {
    M[r] = [];
    var _row = row(M1, r);
    for (c=0; c<dims[3]; c++) {
      var _col = col(M2,c);
      var reducer = (a,v,i) => a + _col[i]*v;
      M[r][c] = _row.reduce(reducer, 0);
    }
  }
  return M;
}

var updatePitch;

$('document').ready(function() {
    var menuState = {
	inOptions: false,
	onCancel: false,
	onNext: false,
	onToggle: false,
	oSelected: false
    }


    var canvas = $('canvas')[0];
    var ctx = canvas.getContext('2d');
    ctx.strokeStyle= 'blue';
    ctx.lineWidth = '7';

    function randomCurve() {
	var points = [];
	for(var i=0; i<7; i++) {
	    points.push([10+40*i,10+Math.round(90*Math.random())]);
	}
	let rlpoints = points.map(offset(350,150));
	px = [];
	py = [];
	rlpoints.forEach(p => {
	    px.push( [x(p)] );
	    py.push( [y(p)] );
	})

	let invert = matrix_invert,
	    M1 = invert(M7),
	    Tt = []; // apparently I was generating the transpose

	// Equidistant time values curve-fitting
	let S = '0'.repeat(7).split('').map((_,i) => i/(7-1));
	for(var i=0; i<7; i++) Tt.push(raiseRowPower(S, i));

	// TODO REPLACE let
	var T = transpose(Tt),
	    TtT1 = invert(multiply(Tt,T)),
	    step1 = multiply(TtT1, Tt),
	    step2 = multiply(M1, step1),
	    Cx = multiply(step2, px),
	    Cy = multiply(step2, py);

	return {
	    points: rlpoints,
	    controls: Cx.map((s, i) => s.concat(Cy[i]))
	}
    }

    function drawCurve() {
	drawMatrix(M7, curve.controls);
	//drawPoints(curve.points);
    }
    // using state mutation to determine if we have success
    // another way to do this is to use an array of points
    // along the curve, each needing to be "touched"
    // Should I remove all state as I did for Piano?
    // Using state like this requires me to negate a
    // default success criteria, which I DO NOT LIKE
    var hasMastered = true;
    var suspectCount = 0; // bad pitch detection
    var failureCount = 0; // means of lowering challenge
    function setCurve(c) {
	curve = c;
	hasMastered = true;
    }
    setCurve(randomCurve())
    drawCurve();

    function incBez(bezFunc, pts, span) {
	let xs=pts.map(x),
	    ys=pts.map(y);

	// TODO FIXME add point constructor to eliminate level mixing
	if(!span) {
	    start = pts[0];
	    span = { start: 0, end: 1 };
	} else {
	    span.start = Math.max(span.start, 0);
	    span.end = Math.min(span.end, 1);
	    start = [ bezFunc(span.start,xs),
		      bezFunc(span.start,ys) ];
	}
	ctx.beginPath();
	ctx.moveTo(x(start),y(start));
	var t;
	for(t=Math.max(span.start, 0); t<=Math.min(span.end, 1); t+=0.01) {
	    ctx.lineTo(bezFunc(t,xs),
		    bezFunc(t,ys));
	}
	ctx.stroke();
    }


    /*
    function makeInteractive(pointArray) {
	var start = pointArray[0][0],
	    end = pointArray[6][0],
	    intv = end - start,
	    xs = pointArray.map(x),
	    ys = pointArray.map(y);

	// draw point on curve with mouseover
	$('canvas').on('mousemove', function(ev) {
	    let x = Math.min(Math.max(start, ev.clientX), end),
		t = (x-start)/intv,
	        y = bez7(t, ys);

	    // TODO box style collision
	    // 1. check bounding box
	    // 2. check curve within small box for given t-value
	    // 3. function - write t-d to t+d instead of whole curve

	    // TODO FIXME this collision detection is not smooth
	    // consider finding roots after 90-degree rotate
	    if(Math.abs(ev.clientY - y) < 20) {
		ctx.strokeStyle = 'yellow';
		incBez(bez7, pointArray, {start: t-0.02, end: t+0.02});
	    }
	});
    }
    */

    function drawMatrix(M, ps) {
	px = [];
	py = [];
	ps.forEach(p => {
	    px.push( [x(p)] );
	    py.push( [y(p)] );
	})
	let start = ps[0];
	ctx.beginPath();
	ctx.moveTo(x(start), y(start));
	for(var t=0; t<1; t+= 0.01) {
	    let T = [ range(0,7).map(k => Math.pow(t,k)) ];
	    let PART_X = multiply(M, px);
	    let PART_Y = multiply(M, py);
	    ctx.lineTo(multiply(T, PART_X), multiply(T, PART_Y));
	}
	ctx.stroke();
    }

    function drawPoints(ps) {
	ps.forEach(function(e){
	    ctx.fillStyle = 'red';
	    ctx.beginPath();
	    ctx.arc(x(e),y(e),3,0,2*Math.PI)
	    ctx.closePath();
	    ctx.fill();
	    });
    }

    function raiseRowPower(row,i) {
	return row.map(v => Math.pow(v,i));
    }




    // TODO set up reasonable defaults
    var whistleX = START_X,
	whistlePrevX = 0,
	whistlePrevY = 0;

    var reticle = new Image();
    reticle.src = 'green-reticle.png';

    // we will demand certainty if noise is more likely
    // (delta > X from last sample)
    var noiseDelay = 3;
    var pitchBuffer = [];

    function smooth(buf) {
	return !buf.length? 0 : buf.reduce((a,b)=>a+b) / buf.length;
    }

    function smoothKeep(buf) {
	if(buf.length == 3) {
	    buf[buf.length-1] = (buf[0]+buf[1]+buf[2])/3.0;
	    return buf[buf.length-1];
	} else return smooth(buf);
    }

    function smoothWeighted5(buf) {
	if(buf.length == 5)
	    return (buf[0]+2*buf[1]+3*buf[2]+2*buf[3]+buf[4])/9.0
	else return smooth(buf);
    }



    // TODO remove external state
    function drawOptions(selectionState) {
	let s = selectionState;
	ctx.save();
	var alpha = s.inOptions ? '1.0' : '0.2';
	ctx.fillStyle = "rgba(255, 165, 0, "+alpha+")";
	ctx.beginPath();
	ctx.ellipse(END_X-10, OPTIONS_Y, 18, 10, 0, 2*Math.PI, false);
	ctx.closePath();
	ctx.fill();

	if(s.inOptions) {
	    alpha = s.onCancel ? '1.0' : '0.4';
	    ctx.fillStyle = "rgba(128, 128, 128, "+alpha+")";
	    ctx.beginPath();
	    ctx.ellipse(END_OPTIONS_X-10, 280, 18, 10, 0, 2*Math.PI, false);
	    ctx.closePath();
	    ctx.fill();

	    alpha = s.onNext? '1.0' : '0.4';
	    ctx.fillStyle = "rgba(216, 191, 216, "+alpha+")";
	    ctx.beginPath();
	    ctx.ellipse(END_OPTIONS_X-10, 230, 18, 10, 0, 2*Math.PI, false);
	    ctx.closePath();
	    ctx.fill();

	    alpha = s.onToggle? '1.0' : '0.4';
	    ctx.fillStyle = "rgba(255, 99, 71, "+alpha+")";
	    ctx.beginPath();
	    ctx.ellipse(END_OPTIONS_X-10, 180, 18, 10, 0, 2*Math.PI, false);
	    ctx.closePath();
	    ctx.fill();

	}
	ctx.restore();
    }


    updatePitch = function() {
	var whistleY = undefined;
	// FIXME use a closure to set this function up
	let s = menuState;

	// order here matters, this can be simplified

	if(s.inOptions) {
	    if(whistleX >= END_OPTIONS_X) {
		if(s.oSelected) {
		    if(s.onToggle) toggleSing();
		    else if(s.onNext) {
			DELTA_X = Math.min(DELTA_X, 2);
			setCurve(randomCurve());
			// some of setup happens below (resetting whistleX, hasMastered)
			// I should think about how to make a function with with these separate
		    }
		    s.inOptions = s.onToggle = s.onNext = s.onCancel = s.oSelected = false;
		    whistleX = getStartX();
		    hasMastered = true; // setup for next round
		    suspectCount = 0;
		} else whistleX = START_OPTIONS_X;
	    }
	} else if(whistleX > END_X) {

	    console.log('speed',DELTA_X);

	    if(suspectCount > 10) {
		console.log('Inconsistent pitch -', suspectCount);
		hasMasterd = false;
	    }

	    if(hasMastered) {
		if(DELTA_X >= 3) {
		    setCurve(randomCurve());
		    DELTA_X = 2;
		} else DELTA_X = Math.min(DELTA_X*1.5, 3); 
		failureCount = 0;
		console.log('MASTERED!');
	    } else {
		if(failureCount > 4) {
		    failureCount = 0;
		    DELTA_X = Math.max(1, DELTA_X-1);
		    // TODO implement difficulty level in terms of points
		    // This will give a sense of progression / regression
		    console.log('BOOTED!!');
		    console.log('new speed',DELTA_X);
		} else failureCount++;
	    }

	    // THIS WILL NEED TO MOVE, THEY COULD CHOOSE OPTIONS
	    hasMastered = true; // we start with mastered and negate with mistakes
	    suspectCount = 0;

	    whistleX = getStartX();
	}

	$('#reticle').css('left',whistleX);


	// FIXME use a closure to set curve, menuState, etc
	ctx.clearRect(0,0, canvas.width,canvas.height);
	ctx.lineWidth = '7';
	ctx.strokeStyle = 'blue';
	drawCurve();
	ctx.lineWidth = '5';
	ctx.strokeStyle = 'yellow';
	drawCurve();
	ctx.lineWidth = '6';

	analyser.getFloatTimeDomainData( buf );
	var pitch = audio.autoCorrelate( buf, audioContext.sampleRate );

	// will take advantage of the fact that
	// breaks during the curve indicate failure
	var curveStartX = getCurveStartX(),
	    curveEndX = getCurveStartY(),
	    curveWidth = curveEndX - curveStartX,
	    withinCurveX = curveStartX <= whistleX && whistleX <= curveEndX,
	    attempting = false;


	// confident threshold met
	if(pitch != -1) {
	    var note =  audio.noteFromPitch( pitch );
	    // would I ever need this level of precision here?
	    var detune = audio.centsOffFromPitch( pitch, note );
	    // less than 0? flat. greater than 0? sharp

	    // TODO if I move noise into this conditional, will it simplify code?
	    if(note < 108) { 
		attempting = true;

		// SMOOTHING TESTS
		//pitchBuffer.push(canvas.height-pitch+correction);


		//let inverted = Math.round(canvas.height-pitch+correction),
		// console.log(`pitch ${pitch} h() ${heightFromPitch(pitch)}`);

		// upper boundaries
		function circ(h,col) {
		    ctx.fillStyle = col || 'black';
		    ctx.beginPath();
		    ctx.arc(200, canvas.height-h, 2, 0, Math.PI);
		    ctx.closePath();
		    ctx.fill();
		}
		function lin(h,col) {
		    ctx.strokeStyle = col || 'black';
		    _lw = ctx.lineWidth;
		    ctx.lineWidth = '2';
		    ctx.beginPath();
		    ctx.moveTo(0,canvas.height-h);
		    ctx.lineTo(canvas.width,canvas.height-h);
		    ctx.stroke();
		    // reset
		    ctx.lineWidth = _lw;
		}
		/*
		lin(100);
		lin(200);
		lin(300);
		*/

		//let inverted = Math.round(canvas.height-pitch+correction),
		let inverted = Math.round(canvas.height - heightFromPitch(pitch)),
		    pl = pitchBuffer.length,
		    prev = !!pl ? pitchBuffer[pl-1] : null;

		let isNoise = (prev !== null && Math.abs(prev-inverted) > 250); // likely noise
		if(isNoise) {
		    if(!noiseDelay) { // consecutive samples agree
			noiseDelay = 3;
			pitchBuffer = [inverted]; // rapid shift, do not average
		    } else noiseDelay -= 1
		} else pitchBuffer.push(inverted);


		//let whistleY = pitchBuffer[pitchBuffer.length-1];
		//whistleY = 5*Math.floor(whistleY / 5);

		//if(pitchBuffer.length > 3) pitchBuffer.shift();
		// let whistleY = smooth(pitchBuffer);
		// let whistleY = smoothKeep(pitchBuffer);

		if(pitchBuffer.length > 3) pitchBuffer.shift();
		whistleY = Math.round(smoothKeep(pitchBuffer));


		// if(pitchBuffer.length > 5) pitchBuffer.shift();
		// let whistleY = smoothWeighted5(pitchBuffer);
		// let whistleY = Math.round(smoothWeighted5(pitchBuffer));

		ctx.drawImage(reticle, whistleX-10, whistleY-10, 20, 20);

		// FIXME menuState should be passed in or closed in obvious manner
		let s = menuState,
		    ys = curve.controls.map(y);

		if(withinCurveX) {
		    let t = (whistleX-curveStartX)/curveWidth,
			y = bez7(t, ys),
			valid = true;
			//valid = Math.abs(whistleY - y) < accuracy;

		    //ctx.strokeStyle = valid ? 'yellow' : 'orange';
		    //ctx.strokeStyle = valid ? 'blue' : 'yellow';
		    ctx.strokeStyle = valid ? 'yellow' : 'blue';

		    if(!valid) hasMastered = false; // commenting this will allow me to test progression
		    
		    if(valid) {
		    	_ss = ctx.strokeStyle;
		    	ctx.strokeStyle = 'blue';
		    	drawCurve();
		    	ctx.strokeStyle = _ss;
		    }
		    _lw = ctx.lineWidth;
		    ctx.lineWidth = '5';
		    incBez(bez7, curve.controls, {start: t-0.02, end: t+0.02});
		    ctx.lineWidth = _lw;

		} else if(whistleX > END_X-40) {
		    // selecting options
		    if(80 <= whistleY && whistleY <= 115)
			s.inOptions = true;

		    // selecting option
		    if(!s.oSelected && whistleX >= END_OPTIONS_X-40) {
			if(260 <= whistleY && whistleY <= 300) 
			    s.onCancel = s.oSelected = true;
			else if(210 <= whistleY && whistleY <= 250) 
			    s.onNext = s.oSelected = true;
			else if(160 <= whistleY && whistleY <= 200)
			    s.onToggle = s.oSelected = true;
		    }

		}
	    } else if(withinCurveX) suspectCount++; // we got an unnaturally high pitch value - air conditioners, fans, etc
	}

	if(withinCurveX && !attempting) {
	    console.log('NOPE');
		hasMastered = false;
	}

	drawOptions(menuState);
	if(typeof whistleY !== 'undefined')
	    ctx.drawImage(reticle, whistleX-10, whistleY-10, 20, 20);
	else if(withinCurveX) {
	    // FIXME here we are likely "suspect", pitch is fluttering in and out
	    /*
		currently reticle disappears and looks choppy
		2 solutions:
		1. whistle / sing stronger
		(indicate via color change on reticle / strength meter) 

		2. keep last position, and during suspect use last known-Y
	    */


	    console.log('undefined Y');
	}

	whistleX += menuState.inOptions ? Math.min(DELTA_X, 3) : DELTA_X;

	if (!window.requestAnimationFrame)
	    window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	rafID = window.requestAnimationFrame( updatePitch );
    }

    mic.enable();
});
