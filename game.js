// IMPORTANT: MAX WHISTLE IS WORLD RECORD
// This is to filter noise - but someone out there will be trying.
// NOTE: Consider Paper.js for mimic/score modeling (Path simplification)

// TODO Encapsulate constants

// instead of whistling
const INITIAL_SPEED = 2;
const START_X = 250;
const END_X = 750;
const START_OPTIONS_X = END_X-40;
const END_OPTIONS_X = 950;
const OPTIONS_Y = 100;
const ACCURACY = 20;



function pitchToPos(gc, pitch) {
    return Math.round(gc.gfx.height - heightFromPitch(gc.sing, pitch));
}

function heightFromPitch(doSing, p) {
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


function raiseRowPower(row,i) {
    return row.map(v => Math.pow(v,i));
}

// FIXME only works with M7 right now!!!!
function computeMatrix(order) {
    if(order === 7) return M7;
    else alert('oops');
}

function randomCurve(order) {
    var points = [];
    for(var i=0; i<order; i++) {
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

    let T = transpose(Tt),
	TtT1 = invert(multiply(Tt,T)),
	step1 = multiply(TtT1, Tt),
	step2 = multiply(M1, step1),
	Cx = multiply(step2, px),
	Cy = multiply(step2, py);

    // FIXME use only points? only controls?
    B = new Bezier(rlpoints,
		   Cx.map((s, i) => s.concat(Cy[i])));
    B.setMatrix(M7);
    return B;
}

var gameImages  = [{ name: 'reticle', src: 'green-reticle.png' }];

class Graphics {

    constructor(canvas) {
	this.canvas = canvas;
	this.ctx = canvas.getContext('2d');
	this.metronome = $('#metronome');
	this.images = {};
	gameImages.forEach( img => {
	    this.images[img.name] = new Image();
	    this.images[img.name].src = img.src;
	});
	this.baseStyle = {
	    'strokeStyle': 'blue',
	    'lineWidth': '7'
	}
    }


    get width() {
	return this.canvas.width;
    }

    get height() {
	return this.canvas.height;
    }

    clear() {
	this.ctx.clearRect(0,0, this.width,this.height);
    }

    clearOptions() {
	this.ctx.clearRect(START_OPTIONS_X-10,0, // room for cursor
			   this.width,this.height);
    }

    slideMetronome(x) {
	this.metronome.css('left', x);
    }

    drawTarget(pos) {
	this.ctx.drawImage(this.images.reticle, pos.x, pos.y, 20, 20);
    }

    drawCurve(curve, opts) {
	this.ctx.save();
	let _opts = curve.opts || {};
	opts = Object.assign({}, _opts, opts);
	//opts = opts || curve.opts;
	for(var o in opts) {
	    this.ctx[o] = opts[o];
	}
	this.drawMatrix(curve);
	this.ctx.restore();
	//this.drawPoints(curve);
    }

    highlightCurve(curve, opts) {
	/*
	let _opts = curve.opts || {};
	opts = Object.assign({}, _opts, opts);
	this.drawCurve(curve, opts);
	let _opts = curve.opts || {};
	opts = Object.assign({}, _opts, opts);
	*/
	let _opts = curve.opts || {};
	opts = Object.assign({}, _opts, opts);
	let n = Number.parseInt(opts.lineWidth);
	Object.assign(opts, {
	    'lineWidth': (n-1).toString(),
	    'strokeStyle': 'yellow'});
	this.drawCurve(curve, opts);
    }

    drawSegment(curve, span, opts) {
	span = span || { start: 0, end: 1 }; 

	span.start = Math.max(span.start, 0);
	span.end = Math.min(span.end, 1);

	let ctx = this.ctx,
	    _opts = curve.opts || {};
	opts = Object.assign({}, _opts, opts);

	ctx.save();
	for(var o in opts) {
	    this.ctx[o] = opts[o];
	}
	ctx.beginPath();
	ctx.moveTo(curve.computeX(span.start),
		   curve.computeY(span.start));
	var t;
	for(t = span.start; t <= span.end; t += 0.01) {
	    ctx.lineTo(
		curve.computeX(t),
		curve.computeY(t)
	    );
	}
	ctx.stroke();
	ctx.restore();
    }

    // fat segments
    drawSegmentDelta(curve, t, delta, opts) {
	this.drawSegment(curve, {
	    start: t-delta,
	    end: t+delta
	}, opts);
    }

    // consider using De Casteljau 
    drawMatrix(curve) {
	let ps = curve.controls,
	    px = [],
	    py = [],
	    ctx = this.ctx,
	    M = curve.matrix;

	curve.controls.forEach(p => {
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
	ctx.restore();
    }

    drawPoints(curve) {
	let ctx = this.ctx;
	ctx.save();
	curve.points.forEach(function(e){
	    ctx.fillStyle = 'red';
	    ctx.beginPath();
	    ctx.arc(x(e),y(e),3,0,2*Math.PI)
	    ctx.closePath();
	    ctx.fill();
	    });
	ctx.restore();
    }

    // boolean predicate expected
    drawOption(rgb, xy, predicate) {
	let ctx = this.ctx;
	let alpha = predicate ? '1.0' :
	    rgb.length == 4 ? rgb[3] : '0.4';
	ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]}, ${rgb[2]}, ${alpha})`;
	ctx.beginPath();
	ctx.ellipse(xy[0]-10, xy[1], 18, 10, 0, 2*Math.PI, false);
	ctx.closePath();
	ctx.fill();
    }

    drawOptions(menu) {
	let x1 = END_X,
	    x2 = END_OPTIONS_X;
	this.drawOption([255,165,0, 0.2], [x1, OPTIONS_Y], !!menu);
	if(menu) {
	    let m = menu;
	    this.drawOption([128,128,128], [x2, 280], m.onCancel);
	    this.drawOption([216,191,216], [x2, 230], m.onNext);
	    this.drawOption([255, 99, 71], [x2, 180], m.onToggle);
	}
    }

    drawOptionsMenu(menuContext) {
	this.drawOptions(menuContext);
    }

}

class Bezier {

    // FIXME use only points? only controls?
    constructor(points, controls) {
	this.order = controls.length;
	this.points = points;
	this.controls = controls;
	this.controls.xs = controls.map(p => p[0]);
	this.controls.ys = controls.map(p => p[1]);
    }

    // FIXME only temporary
    // will use (computed) matrix only
    // for initial fitting
    // and generate LUT from there
    setMatrix(m) {
	this.matrix = m;
    }

    get startX() {
	return this.controls[0][0];
    }

    get endX() {
	return this.controls[this.order-1][0]; // FIXME order is off-by-one
    }

    get width() {
	return this.endX - this.startX;
    }

    // FIXME make generic
    compute(t, vals) {
	return bez7(t, vals);
    }

    computeX(t) {
	return this.compute(t, this.controls.xs);
    }

    computeY(t) {
	return this.compute(t, this.controls.ys);
    }

    inboundX(x) {
	if(x < this.startX
	   || x > this.endX) return false;
	let t = this.map(x);
	return 0 <= t && t <= 1;
    }

    map(x) {
	return this.offset(x) / this.width;
    }

    offset(x) {
	return x - this.startX;
    }
}


let startState  = {
    
    setup: function(gameContext, pitch) {
	let gc = gameContext;

	// need a curve, perdiod!
	if(!gc.curve)
	    gc.setCurve(randomCurve(7)); // TODO difficulty


	// we want consecutive successes
	if(!!gc.failCount) {
	    gc.successCount = 0;
	    // need something a little easier
	    if(gc.failCount >= 3) {
		gc.speed = Math.min(Math.max(gc.speed-1, 1), 2);
		gc.failCount = 0;
		console.log('BOOTED, speed=',gc.speed);
	    }
	}

	// need another challenge!
	if(!!gc.successCount && gc.speed >= 3) {
	    console.log('MASTERED!');
	    gc.speed = INITIAL_SPEED;
	    gc.setCurve(randomCurve(7));
	    gc.successCount = 0;
	    gc.failCount = 0;
	}

	// just need to speed things up a little
	if(!!gc.successCount) {
	    console.log("Congrats!  Let's go faster...");
	    gc.speed = Math.min(gc.speed*1.5, 3); 
	}

	// start position (depends on speed)
	gc.posX = gc.curve.startX - 55 * gc.speed;
    },

    handlePitch: function(gameContext, pitch) {
	gameContext.transition(simpleState);
    }

}

let simpleState = {
    
    setup: function(gc) {
	gc.render.highlite = true;
    },

    handlePitch: function(gameContext, pitch) {
	let gc = gameContext,
	    state;

	if(gc.curve.inboundX(gc.posX))
	    state = tryState;

	else if(gc.posX > START_OPTIONS_X &&
	   80 <= gc.posY && gc.posY <= 115) 
	    state = optionState;

	else if(gc.posX > END_X)
	    state = startState;

	if(state) gameContext.transition(state);
    },
    
    teardown: function(gc) {
	gc.render.highlite = false;
    }
}


let tryState = {

    setup: function() {
	this.failed = false;
    },

    handlePitch: function(gameContext, pitch) {

	let gc = gameContext,
	    gfx = gc.gfx;

	let t = gc.curve.map(gc.posX),
	    y = gc.curve.computeY(t),
	    valid = Math.abs(gc.posY - y) < ACCURACY;

	if(valid) gfx.drawCurve(gc.curve);
	else gfx.highlightCurve(gc.curve);

	let opts = {
	    lineWidth: '5',
	    strokeStyle: valid ? 'yellow' : 'blue'
	};
	gfx.drawSegmentDelta(gc.curve, t, 0.02, opts);

	if(!valid) this.failed = true;

	if(gc.posX >= gc.curve.endX) 
	    gc.transition(this.failed ?
			  simpleState : successState);
    },

    teardown: function(gameContext, pitch) {
	if(this.failed) gameContext.failCount++;
    }
}


let successState = {

    setup: function(gameContext, pitch) {
	console.log('SUCCESS!!');
    },

    handlePitch: function(gameContext, pitch) {
	let gc = gameContext;
	    opts = gc.curve.opts;
	_ss = opts.strokeStyle;
	opts.strokeStyle = 'green';
	setTimeout(function() {
	    opts.strokeStyle = _ss;
	}, 500);
	gc.successCount++;
	gc.transition(simpleState);
    },

    // consider?
    teardown: function(gameContext, pitch) {
	gameContext.failCount = 0;
    }
}


let optionState = {

    setup: function(gameContext, pitch) {
	gameContext.render.options = false;
	this.options = {
	    onCancel: false,
	    onNext: false,
	    onToggle: false,
	};
    },

    handlePitch: function(gameContext, pitch) {
	let gc = gameContext,
	    gfx = gc.gfx,
	    m = this.options;

	gfx.drawOptionsMenu(this.options);

	let oSelected = Object.values(this.options).some(v=>v);

	// only select an option if we haven't yet
	if(!oSelected && gc.posX >= END_OPTIONS_X-40) {
	    if(260 <= gc.posY && gc.posY <= 300) 
		m.onCancel = oSelected = true;
	    else if(210 <= gc.posY && gc.posY <= 250) 
		m.onNext = oSelected = true;
	    else if(160 <= gc.posY && gc.posY <= 200)
		m.onToggle = oSelected = true;
	}

	if(gc.posX >= END_OPTIONS_X) {
	    if(oSelected) gc.transition(startState );
	    else gc.posX = START_OPTIONS_X;
	}
    },

    // FIXME remove speed and stuff
    teardown: function(gameContext, pitch) {
	let m = this.options,
	    gc = gameContext;
	if(m.onToggle) gc.toggleSing();

	if(m.onNext) {
	    gc.curve = null; 
	    gc.successCount = 0;
	    gc.failCount = 0;
	}

	// TODO delete if not needed
	gc.posX = 0;
	gameContext.render.options = true;
    }
}


$('document').ready(function() {

    let gameContext = {
	state: null,
	curve: null,
	speed: INITIAL_SPEED,
	successCount: 0,
	failCount: 0,
	posX: START_X,
	posY: 0,
	render: {
	    options: true,
	    curve: true,
	},
	gfx: new Graphics($('canvas')[0]),
	sing: false,
	transition(s) {
	    if(this.state && this.state.teardown) {
		this.state.teardown(this);
	    }
	    if(s.setup) s.setup(this);
	    this.state = s;
	},
	setCurve: function(c, opts) {
	    opts = opts ||
		Object.assign({}, this.gfx.baseStyle);
	    this.curve = c;
	    this.curve.opts = opts;
	},
	doRender: function() {
	    this.gfx.slideMetronome(this.posX);
	    this.gfx.clear();
	    if(this.render.curve && this.curve)
		this.gfx.drawCurve(this.curve);
	    if(this.render.options)
		this.gfx.drawOptions();
	    this.gfx.drawTarget({ x: this.posX-10, y: this.posY-10});
	},
	handlePitch: function(pitch) {
	    this.posX = this.posX += this.speed;
	    this.posY = pitchToPos(this, pitch);
	    this.doRender();
	    this.state.handlePitch(this, pitch);
	},
	toggleSing: function() {
	    this.sing = !this.sing;
	},
    }


    gameContext.transition(startState);

    handlePitch = p => gameContext.handlePitch(p);

    let mic = window.mic = new Microphone;
    mic.enable();
});
