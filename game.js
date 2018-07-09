// IMPORTANT: MAX WHISTLE IS WORLD RECORD
// This is to filter noise - but someone out there will be trying.
// NOTE: Consider Paper.js for mimic/score modeling (Path simplification)

// TODO Encapsulate constants

// instead of whistling

const DEBUG = true;
const ZERO = { x: 0, y: 0, z: 0 };
const MIN_SPEED = 0.1;
const MIN_DIFFICULTY = 2;
const INITIAL_SPEED = 0.1;
const MAX_SPEED = 0.2;
const START_X = 100;
const END_X = 750;
const START_OPTIONS_X = END_X-40;
const END_OPTIONS_X = 950;
const OPTIONS_Y = 100;
const ACCURACY = 20;


function pitchToPos(gc, pitch) {
    return Math.round(gc.gfx.height - heightFromPitch(gc.sing, pitch));
}


// TODO custom vocal ranges
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


// I computed this by hand
// only to discover the pattern later
// below is the method lifted from bezier-js
// notice the diagonal is the binomial term (order)
let M6 = [[  1,   0,   0,   0,   0,   0,   0],

	  [ -6,   6,   0,   0,   0,   0,   0],

	  [ 15, -30,  15,   0,   0,   0,   0],

	  [-20,  60, -60,  20,   0,   0,   0],

	  [ 15, -60,  90, -60,  15,   0,   0],

	  [ -6,  30, -60,  60, -30,   6,   0],

	  [  1,  -6,  15, -20,  15,  -6,   1]];

var binomialCoefficients = [[1],[1,1]];

function binomial(n,k) {
  if (n===0) return 1;
  var lut = binomialCoefficients;
  while(n >= lut.length) {
    var s = lut.length;
    var nextRow = [1];
    for(var i=1,prev=s-1; i<s; i++) {
      nextRow[i] = lut[prev][i-1] + lut[prev][i];
    }
    nextRow[s] = 1;
    lut.push(nextRow);
  }
  return lut[n][k];
}

// from bezier-js
function computeMatrix(n) {
  /*
    We can form any basis matrix using a generative approach:

     - it's an M = (n x n) matrix
     - it's a lower triangular matrix: all the entries above the main diagonal are zero
     - the main diagonal consists of the binomial coefficients for n
     - all entries are symmetric about the antidiagonal.

    What's more, if we number rows and columns starting at 0, then
    the value at position M[r,c], with row=r and column=c, can be
    expressed as:

      M[r,c] = (r choose c) * M[r,r] * S,

      where S = 1 if r+c is even, or -1 otherwise

    That is: the values in column c are directly computed off of the
    binomial coefficients on the main diagonal, through multiplication
    by a binomial based on matrix position, with the sign of the value
    also determined by matrix position. This is actually very easy to
    write out in code:
  */

  // form the square matrix, and set it to all zeroes
  var M = [], i = n;
  while (i--) { M[i] = "0".repeat(n).split('').map(v => parseInt(v)); }

  // populate the main diagonal
  var k = n - 1;
  for (i=0; i<n; i++) { M[i][i] = binomial(k, i); }

  // compute the remaining values
  for (var c=0, r; c<n; c++) {
    for (r=c+1; r<n; r++) {
      var sign = (r+c)%2 ? -1 : 1;
      var value = binomial(r, c) * M[r][r];
      M[r][c] = sign * value; }}

  return M;
}

function range(n,m) {
    var nums = [];
    for(var i=n; i<m; i++)
        nums.push(i);
    return nums;
}

// computed this by hand, moving to more general method
// (de Casteljau's method) from BezierJS
function bez6(t,ws) {
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


function randomCurve(order) {

    let offset = (x,y) => p => ({ x: p.x+x, y: p.y+y });

    var points = [];
    for(var i=0; i<=order; i++) {
	points.push({
	    x: i*Math.floor(240.0/order),
	    y: Math.round(90*Math.random())
	});
    }
    points = points.map(offset(360,160));
    px = [];
    py = [];
    points.forEach(p => {
	px.push( [p.x] );
	py.push( [p.y] );
    })

    let invert = matrix_invert,
	M = computeMatrix(order+1),
	Tt = []; // apparently I was generating the transpose

    // Equidistant time values curve-fitting
    let S = '0'.repeat(order+1).split('').map((_,i) => i/(order));
    for(var i=0; i<=order; i++) Tt.push(raiseRowPower(S, i));

    let T = transpose(Tt),
	M1 = invert(M),
	TtT1 = invert(multiply(Tt,T)),
	step1 = multiply(TtT1, Tt),
	step2 = multiply(M1, step1),
	Cx = multiply(step2, px),
	Cy = multiply(step2, py);

    B = new Bezier(points,
		   Cx.map((s, i) => ({x: s[0], y: Cy[i][0]})));
    B.setMatrix(M);
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

    /*
    drawCurve(curve, opts) {
	this.ctx.save();
	for(var o in opts) {
	    this.ctx[o] = opts[o];
	}
	this.drawMatrix(curve);
	this.ctx.restore();
	this.drawPoints(curve);
    }
    */

    drawCurve(curve, opts, offset) {
	offset = offset || { x:0, y:0 };
	this.ctx.save();
	for(var o in opts) {
	    this.ctx[o] = opts[o];
	}
	var p = curve.controls;
	if (p.length < 3 || 5 <= p.length) {
	    var points = curve.getLUT(100);
	    var p0 = points[0];
	    this.ctx.beginPath();
	    this.ctx.moveTo(p0.x,p0.y);
	    points.forEach((p1,i) => {
		if(!i) return;
		this.ctx.lineTo(p0.x, p0.y, p1.x, p1.y);
		p0 = p1;
	    });
	    this.ctx.stroke();
	    if(DEBUG) this.drawPoints(curve);
	    return;
	}

	var ox = offset.x;
	var oy = offset.y;
	this.ctx.beginPath();
	this.ctx.moveTo(p[0].x + ox, p[0].y + oy);
	if(p.length === 3) {
	    this.ctx.quadraticCurveTo(
		p[1].x + ox, p[1].y + oy,
		p[2].x + ox, p[2].y + oy
	    );
	}
	else if(p.length === 4) {
	    this.ctx.bezierCurveTo(
		p[1].x + ox, p[1].y + oy,
		p[2].x + ox, p[2].y + oy,
		p[3].x + ox, p[3].y + oy
	    );
	}
	this.ctx.stroke();
	this.ctx.closePath();
	this.ctx.restore();
	if(DEBUG) this.drawPoints(curve);
    }

    // TODO FIXME optimize using curve LUT
    // to avoid recomputing all the time
    // shifting indices, not shifting
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
	var p = curve.compute(span.start);
	ctx.moveTo(p.x, p.y);
	var t;
	for(t = span.start; t <= span.end; t += 0.01) {
	    p = curve.compute(t);
	    ctx.lineTo(p.x, p.y);
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

    // this does computation on the fly
    // will switch to LUT method from BezierJS
    drawMatrix(curve) {
	let ps = curve.controls,
	    px = [],
	    py = [],
	    ctx = this.ctx,
	    M = curve.matrix;

	curve.controls.forEach(p => {
	    px.push( [p.x] );
	    py.push( [p.y] );
	})
	let start = ps[0];
	ctx.beginPath();
	ctx.moveTo(start.x, start.y);
	for(var t=0; t<1; t+= 0.01) {
	    let T = [ range(0,curve.order+1).map(k => Math.pow(t,k)) ];
	    let PART_X = multiply(M, px);
	    let PART_Y = multiply(M, py);
	    ctx.lineTo(multiply(T, PART_X), multiply(T, PART_Y));
	}
	ctx.stroke();
	ctx.restore();
    }

    drawPoints(curve) {
	this.ctx.save();
	curve.points.forEach( p => {
	    this.ctx.fillStyle = 'red';
	    this.ctx.beginPath();
	    this.ctx.arc(p.x,p.y,3,0,2*Math.PI)
	    this.ctx.closePath();
	    this.ctx.fill();
	    });
	this.ctx.restore();
    }

    // boolean predicate expected
    drawOption(rgb, xy, predicate) {
	let alpha = predicate ? '1.0' :
	    rgb.length == 4 ? rgb[3] : '0.4';
	this.ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]}, ${rgb[2]}, ${alpha})`;
	this.ctx.beginPath();
	this.ctx.ellipse(xy[0]-10, xy[1], 18, 10, 0, 2*Math.PI, false);
	this.ctx.closePath();
	this.ctx.fill();
    }

    drawOptions(menu) {
	this.drawOption([255,165,0, 0.2], [END_X, OPTIONS_Y], !!menu);
	if(menu) {
	    this.drawOption([128,128,128], [END_OPTIONS_X, OPTIONS_Y], menu.onCancel);
	    this.drawOption([168,235, 65], [END_OPTIONS_X, 180], menu.onBack);
	    this.drawOption([255, 99, 71], [END_OPTIONS_X, 230], menu.onNext);
	    this.drawOption([216,191,216], [END_OPTIONS_X, 280], menu.onToggle);
	}
    }

    drawOptionsMenu(menuContext) {
	this.drawOptions(menuContext);
    }

}

class Bezier {

    constructor(points, controls) {
	this.order = controls.length-1;
	this.points = points;
	this.controls = controls;
	this.controls.xs = controls.map(p => p.x);
	this.controls.ys = controls.map(p => p.y);
	this._lut = [];
    }

    // FIXME only temporary
    // will use (computed) matrix only
    // for initial fitting
    // and generate LUT from there
    setMatrix(m) {
	this.matrix = m;
    }

    get startX() {
	return this.controls[0].x;
    }

    get endX() {
	return this.controls[this.order].x;
    }

    get width() {
	return this.endX - this.startX;
    }

    // FIXME make generic
    /*
    compute(t) {
	return {
	    x: bez6(t, this.controls.xs),
	    y: bez6(t, this.controls.ys)
	       };
    }
    */

    compute(t) {
      // shortcuts
      if (t === 0) {
        return this.controls[0];
      }
      if (t === 1) {
        return this.controls[this.order];
      }

      var p = this.controls;
      var mt = 1 - t;

      // linear?
      if (this.order === 1) {
        ret = {
          x: mt * p[0].x + t * p[1].x,
          y: mt * p[0].y + t * p[1].y
        };
        if (this._3d) {
          ret.z = mt * p[0].z + t * p[1].z;
        }
        return ret;
      }

      // quadratic/cubic curve?
      if (this.order < 4) {
        var mt2 = mt * mt,
          t2 = t * t,
          a,
          b,
          c,
          d = 0;
        if (this.order === 2) {
          p = [p[0], p[1], p[2], ZERO];
          a = mt2;
          b = mt * t * 2;
          c = t2;
        } else if (this.order === 3) {
          a = mt2 * mt;
          b = mt2 * t * 3;
          c = mt * t2 * 3;
          d = t * t2;
        }
        var ret = {
          x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x,
          y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y
        };
        if (this._3d) {
          ret.z = a * p[0].z + b * p[1].z + c * p[2].z + d * p[3].z;
        }
        return ret;
      }

	// that general method may be too expensive...
	// but I have a major leak elsewhere
	switch(this.order) {
	case 6:
	    return {
		x: bez6(t, this.controls.xs),
		y: bez6(t, this.controls.ys)
	    }
	    break;
	}

	// console.log('NOT OPTIMIZED??!!!');

      // higher order curves: use de Casteljau's computation
      var dCpts = JSON.parse(JSON.stringify(this.controls));
      while (dCpts.length > 1) {
        for (var i = 0; i < dCpts.length - 1; i++) {
          dCpts[i] = {
            x: dCpts[i].x + (dCpts[i + 1].x - dCpts[i].x) * t,
            y: dCpts[i].y + (dCpts[i + 1].y - dCpts[i].y) * t
          };
          if (typeof dCpts[i].z !== "undefined") {
            dCpts[i] = dCpts[i].z + (dCpts[i + 1].z - dCpts[i].z) * t;
          }
        }
        dCpts.splice(dCpts.length - 1, 1);
      }
      return dCpts[0];
    }

    getLUT(steps) {
	steps = steps || 100;
	if (this._lut.length === steps) {
	    return this._lut;
	}
	this._lut = [];
	// We want a range from 0 to 1 inclusive, so
	// we decrement and then use <= rather than <:
	steps--;
	for (var t = 0; t <= steps; t++) {
	    this._lut.push(this.compute(t / steps));
	}
	return this._lut;
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
    
    setup: function(gc) {
	// need a curve, period!
	if(!gc.curve) { // game starts with null
	    console.warn('curve not set for this round'); // otherwise unexpected
	    gc.easierCurve();
	}

	gc.render.curve = OUTCURVE;

	// we want consecutive successes
	if(!!gc.failCount) {
	    gc.successCount = 0;
	    // need something a little easier
	    if(gc.failCount >= 3) {
		// do nothing if slowest and easiest, we don't want to frustrate the player!
		if(gc.speed <= MIN_SPEED && gc.difficulty > MIN_DIFFICULTY) {
		    gc.render.override = FAILURE;
		    setTimeout(() => gc.render.override = false, 750);
		    gc.easierCurve();
		} else gc.resetSlower();
		console.log('BOOTED, speed=',gc.speed);
	    }
	}

	// awkward logic, but:
	// if success hasn't been cleared, it just happened

	// need another challenge!
	if(!!gc.successCount && gc.speed >= MAX_SPEED) {
	    console.log('MASTERED!');
	    gc.harderCurve();
	}

	// just need to speed things up a little
	if(!!gc.successCount) {
	    console.log("Congrats!  Let's go faster...");
	    gc.speed = Math.min(gc.speed*1.5, MAX_SPEED); 
	}

	// start position (depends on speed)
	// FIXME
	gc.posX = START_X;
	// gc.posX = gc.curve.startX - 55 * gc.speed;
    },

    handle: function(gc) {
	return simpleState;
    }
}

let simpleState = {
    
    handle: function(gc) {
	if(gc.curve.inboundX(gc.posX))
	    return tryState;

	else if(gc.posX > START_OPTIONS_X &&
	   80 <= gc.posY && gc.posY <= 115) 
	    return optionState;

	else if(gc.posX > END_X)
	    return startState;
    },
}


let tryState = {

    setup: function(gc) {
	this.failed = false;
	this.prevStyle = gc.render.curve;
	gc.render.curve = INCURVE;
	gc.render.segment = true;
    },

    handle: function(gc) {
	let gfx = gc.gfx;

	let t = gc.curve.map(gc.posX),
	    y = gc.curve.compute(t).y,
	    //y = bez6(t, gc.curve.controls.ys), // FIXME TODO profile memory
	    valid = gc.cheat || Math.abs(gc.posY - y) < ACCURACY;

	gc.render.curve = valid ? INCURVE : OUTCURVE;

	if(!valid) this.failed = true;

	if(gc.posX >= gc.curve.endX) 
	    return this.failed ?
			  simpleState : successState;
    },

    teardown: function(gc) {
	if(this.failed) gc.failCount++;
	gc.render.curve = this.prevStyle;
	gc.render.segment = false;
    }
}


let successState = {

    setup: function(gc) {
	console.log('SUCCESS!!');
    },

    handle: function(gc) {
	gc.render.override = SUCCESS;
	gc.successCount++;
	gc.failCount = 0;
	return simpleState;
    },

    teardown: function(gc) {
	// only in success for one frame
	setTimeout(function() {
	    gc.render.override = false;
	}, 500);
    },
}


let optionState = {

    setup: function(gc) {
	gc.render.options = false;
	this.options = {
	    onCancel: false,
	    onBack: false,
	    onNext: false,
	    onToggle: false,
	};
    },

    handle: function(gc) {
	let m = this.options;

	gc.gfx.drawOptionsMenu(this.options);
	gc.gfx.drawTarget({ x: gc.posX-10, y: gc.posY-10});

	let oSelected = Object.values(this.options).some(v=>v);

	// only select an option if we haven't yet
	if(!oSelected && gc.posX >= END_OPTIONS_X-40) {
	    if(80 <= gc.posY && gc.posY <= 115) 
		m.onCancel = oSelected = true;
	    else if(160 <= gc.posY && gc.posY <= 200)
		m.onBack = oSelected = true;
	    else if(210 <= gc.posY && gc.posY <= 250) 
		m.onNext = oSelected = true;
	    else if(260 <= gc.posY && gc.posY <= 300) 
		m.onToggle = oSelected = true;
	}

	if(gc.posX >= END_OPTIONS_X) {
	    if(oSelected) return startState;
	    else gc.posX = START_OPTIONS_X;
	}
    },

    teardown: function(gc) {
	let m = this.options;
	if(m.onToggle) gc.toggleSing();

	if(m.onNext) {
	    gc.harderCurve();
	}

	if(m.onBack) {
	    gc.easierCurve();
	}

	// TODO delete if not needed
	gc.posX = 0;
	gc.render.options = true;
    }
}


const OUTCURVE = 0,
      INCURVE = 1,
      SUCCESS = 2,
      FAILURE = 3;
const curveStyles = {
    names: ['OUTCURVE, INCURVE', 'SUCCESS', 'FAILURE'],
    def: [{outline: 'blue', accent: 'yellow', segment: 'blue'},
	  {outline: 'yellow', accent: 'blue', segment: 'yellow'},
	  {outline: 'yellow', accent: 'green', segment: 'white'},
	  {outline: 'black', accent: 'red', segment: 'black'}]
};

$('document').ready(function() {

    let gameContext = {
	state: null,
	next: null, // pursuing memory leak, removing variables from loop
	curve: null,
	speed: INITIAL_SPEED,
	difficulty: 2,
	successCount: 0,
	failCount: 0,

	cheat: false, // debug without noise

	posX: START_X,
	posY: 0,
	render: {
	    success: false,
	    failure: false,
	    segment: false,
	    options: true,
	    curve: OUTCURVE
	},
	gfx: new Graphics($('canvas')[0]),
	sing: false,
	doRender: function() {
	    this.gfx.slideMetronome(this.posX);
	    this.gfx.clear();
	    if(this.curve) {
		let type = this.render.override || this.render.curve,
		    cs = curveStyles.def[type];
		    opts = { strokeStyle: cs.outline, lineWidth: 7 };
		    hopts = { strokeStyle: cs.accent, lineWidth: opts.lineWidth-1};

		this.gfx.drawCurve(this.curve, opts);
		this.gfx.drawCurve(this.curve, hopts);
		if(this.render.segment) {
		    let t = this.curve.map(this.posX),
			sopts = { strokeStyle: cs.outline, lineWidth: 5 };
		    this.gfx.drawSegmentDelta(this.curve, t, 0.02, sopts);
		}
	    }
	    if(this.render.options)
		this.gfx.drawOptions();
	    this.gfx.drawTarget({ x: this.posX-10, y: this.posY-10});
	},
	transition: function() {
	    if(this.state && this.state.teardown)
		this.state.teardown(this);
	    this.state = this.next;
	    this.next = null;
	    if(this.state.setup)
		this.state.setup(this);
	},
	easierCurve: function() {
	    if(this.difficulty > 2)
		this.difficulty--;
	    this.setCurve(randomCurve(this.difficulty));
	},
	harderCurve: function() {
	    if(this.difficulty < 6)
		this.difficulty++;
	    this.setCurve(randomCurve(this.difficulty));
	},
	resetSlower: function() {
	    this.successCount = 0;
	    this.failCount = 0;
	    this.speed = Math.min(Math.max(this.speed-0.1, MIN_SPEED), MAX_SPEED);
	},
	setCurve: function(c) {
	    this.curve = randomCurve(this.difficulty);
	    this.speed = INITIAL_SPEED;
	    this.successCount = 0;
	    this.failCount = 0;
	},
	handlePitch: function(pitch, timeDelta, renderOk) {
	    this.posX = this.posX += this.speed * timeDelta;
	    this.posY = pitchToPos(this, pitch);

	    // I could just move this render outside...
	    if(renderOk) {
		this.doRender();
		// I think it's ok to throttle this a little too
		this.next = this.state.handle(this);
		if(this.next)
		    this.transition();
	    }
	},
	toggleSing: function() {
	    this.sing = !this.sing;
	},
    }


    if(DEBUG) {
	var optionHold = false,
	    mouseControl = false,
	    mouseFunc = e => { mouseY = e.clientY; console.log(mouseY); },
	    mouseY = 0;
	document.addEventListener('keydown', e => {
	    if(e.key == 'm') {
		if(!mouseControl) {
		    mouseControl = true;
		    document.addEventListener('mousemove', mouseFunc);
		} else {
		    mouseControl = false;
		    document.removeEventListener('mousemove', mouseFunc);
		}
	    }
	});
	document.addEventListener('keydown', e => {
	    if(e.key == 'c') gameContext.cheat = true;
	    else if(e.key == 'o') optionHold = true;
	    else if(e.key == 'i')
		pitchToPos = p => optionHold ? OPTIONS_Y : mouseControl ? mouseY : 0;
	});
	document.addEventListener('keyup', e => {
	    if(e.key == 'o') optionHold = false;
	    if(e.key == 'c') gameContext.cheat = false;
	});
    }

    // removing all variables to track down memory leak
    gameContext.next = startState;
    gameContext.transition();

    handlePitch = (p,d,r) => gameContext.handlePitch(p,d,r);

    let mic = window.mic = new Microphone;
    mic.enable();
});
