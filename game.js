// IMPORTANT: MAX WHISTLE IS WORLD RECORD
// This is to filter noise - but someone out there will be trying.
// NOTE: Consider Paper.js for mimic/score modeling (Path simplification)

// TODO Encapsulate constants
// TODO rework main update branching
//      -- left of end
//         -- incurve
//      -- right of end (handle master/animation)
//      -- in options

// instead of whistling
const INITIAL_SPEED = 2;

var DELTA_X = INITIAL_SPEED;
// will correct octave for singing
const START_X = 250;
const END_X = 750;
const START_OPTIONS_X = END_X+1;
const END_OPTIONS_X = 950;
const OPTIONS_Y = 100;
const ACCURACY = 20;



function heightFromPitch(p) {
    if(gameState.sing) {
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

    constructor(state, canvas) {
	this.state = state;
	this.canvas = canvas;
	this.ctx = canvas.getContext('2d');
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

    // simplifies utility functions
    get curve() {
	return this.state.curve;
    }

    get startX() {
	return this.curve.startX - 55 * DELTA_X;
    }

    clear() {
	//this.ctx.clearRect(0,0, this.width,this.height);
	this.ctx.clearRect(0,0, this.width,this.height);
    }

    // target could change depending on game-state
    drawTarget(pos) {
	this.ctx.drawImage(this.images.reticle, pos.x, pos.y, 20, 20);
    }

    drawCurve(opts) {
	this.ctx.save();
	opts = opts || this.curve.opts;
	for(var o in opts) {
	    this.ctx[o] = opts[o];
	}
	this.drawMatrix();
	this.ctx.restore();
	this.drawPoints();
    }

    highlightCurve(opts) {
	let _opts = this.curve.opts || {};
	opts = Object.assign({}, _opts, opts);
	this.drawCurve(opts);
	let n = Number.parseInt(opts.lineWidth);
	Object.assign(opts, {
	    'lineWidth': (n-1).toString(),
	    'strokeStyle': 'yellow'});
	this.drawCurve(opts);
    }

    drawSegment(span, opts) {
	span = span || { start: 0, end: 1 }; 

	span.start = Math.max(span.start, 0);
	span.end = Math.min(span.end, 1);

	let ctx = this.ctx,
	    _opts = this.curve.opts || {};
	opts = Object.assign({}, _opts, opts);

	ctx.save();
	for(var o in opts) {
	    this.ctx[o] = opts[o];
	}
	ctx.beginPath();
	ctx.moveTo(this.curve.computeX(span.start),
		   this.curve.computeY(span.start));
	var t;
	for(t = span.start; t <= span.end; t += 0.01) {
	    ctx.lineTo(
		this.curve.computeX(t),
		this.curve.computeY(t)
	    );
	}
	ctx.stroke();
	ctx.restore();
    }

    // fat segments
    drawSegmentDelta(t, delta, opts) {
	this.drawSegment({
	    start: t-delta,
	    end: t+delta
	}, opts);
    }

    // consider using De Casteljau 
    drawMatrix() {
	let ps = this.curve.controls,
	    px = [],
	    py = [],
	    ctx = this.ctx,
	    M = this.curve.matrix;

	this.curve.controls.forEach(p => {
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

    drawPoints() {
	let ctx = this.ctx;
	ctx.save();
	this.curve.points.forEach(function(e){
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

    // TODO move y-calculation into drawOption
    drawOptions(selectionState) {
	let s = selectionState,
	    x1 = END_X,
	    x2 = END_OPTIONS_X;
	this.drawOption([255,165,0, 0.2], [x1, OPTIONS_Y], s.inOptions);
	if(s.inOptions) {
	    this.drawOption([128,128,128], [x2, 280], s.onCancel);
	    this.drawOption([216,191,216], [x2, 230], s.onNext);
	    this.drawOption([255, 99, 71], [x2, 180], s.onToggle);
	}
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


var gameState = {
    curve: null, // TODO
    posX: START_X,
    hasMastered: false, // Revisit this flag
    sing: false,
    curve: null,
    menus: {
	inOptions: false,
	onCancel: false,
	onNext: false,
	onToggle: false,
	oSelected: false
    },
    toggleSing: function() {
	this.sing = !this.sing;
    },
    setCurve: function(gfx, c, opts) {
	opts = opts ||
	    Object.assign({}, gfx.baseStyle);
	this.curve = c;
	this.curve.opts = opts;
    },
    newCurve: function(gfx, order) {
	this.setCurve(gfx, randomCurve(order))
	this.hasMastered = true;
    }
}

function doOptionSelection(gfx, state) {
    let s = state.menus;
    if(state.posX >= END_OPTIONS_X) {
	if(s.oSelected) {
	    if(s.onToggle) state.toggleSing();
	    else if(s.onNext) {
		DELTA_X = Math.min(DELTA_X, 2); // TODO Delta -> state
		state.newCurve(gfx, 7);
	    }
	    s.inOptions = s.onToggle = s.onNext = s.onCancel = s.oSelected = false;
	    state.posX = gfx.startX;
	    state.hasMastered = true; // setup for next round
	} else state.posX = START_OPTIONS_X;
    }
}




// TODO finish state consolidation
$('document').ready(function() {

    let gfx = new Graphics(gameState, $('canvas')[0]);

    // using state mutation to determine if we have success
    // another way to do this is to use an array of points
    // along the curve, each needing to be "touched"
    // Should I remove all state as I did for Piano?
    // Using state like this requires me to negate a
    // default success criteria, which I DO NOT LIKE
    gameState.hasMastered = true;
    var failureCount = 0; // means of lowering challenge
    gameState.newCurve(gfx, 7);

    gameUpdate = function(pitch) {
	var whistleY = undefined;

	// FIXME use a closure to set this function up
	let state = gameState;

	// TODO limit side effects to known areas
	if(state.menus.inOptions) doOptionSelection(gfx, state);
	else if(state.posX > END_X) doEndOfRound(gfx, state);

	function doEndOfRound() {
	    console.log('speed',DELTA_X);
	    if(state.hasMastered) {
		if(DELTA_X >= 3) {
		    // TODO dynamic order
		    gameState.newCurve(gfx, 7);
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
	    state.hasMastered = true; // we start with mastered and negate with mistakes

	    state.posX = gfx.startX;
	}


	// This is just a visual aid
	$('#metronome').css('left',state.posX);


	// FIXME use a closure to set curve, menuState, etc
	// TODO put graphics stuff into Graphics->drawCurve
	gfx.clear();
	gfx.highlightCurve();

	// will take advantage of the fact that
	// breaks during the curve indicate failure


	
	whistleY = Math.round(gfx.height - heightFromPitch(pitch));
	
	let inCurve = gfx.curve.inboundX(state.posX);

	if(inCurve) {
	    let t = gfx.curve.map(state.posX),
		y = gfx.curve.computeY(t),
		valid = Math.abs(whistleY - y) < ACCURACY;
	    
	    //console.log(`ws=${state.posX} y=${y} t=${t}`);
	    
	    if(valid) gfx.drawCurve();
	    else state.mastered = false;
	    
	    let opts = {
		lineWidth: '5',
		strokeStyle: valid ? 'yellow' : 'blue'
	    };
	    gfx.drawSegmentDelta(t, 0.02, opts);
	    
	} else if(state.posX > END_X-40) {
	    // TODO restructure main conditionals
	    let s = gameState.menus;
	    // selecting options
	    if(80 <= whistleY && whistleY <= 115)
		s.inOptions = true;
	    
	    // selecting option
	    if(!s.oSelected && state.posX >= END_OPTIONS_X-40) {
		if(260 <= whistleY && whistleY <= 300) 
		    s.onCancel = s.oSelected = true;
		else if(210 <= whistleY && whistleY <= 250) 
		    s.onNext = s.oSelected = true;
		else if(160 <= whistleY && whistleY <= 200)
		    s.onToggle = s.oSelected = true;
	    }
	    
	}
	
	
	gfx.drawOptions(gameState.menus);
	if(typeof whistleY !== 'undefined')
	    gfx.drawTarget({ x: state.posX-10, y: whistleY-10});
	else console.log('whistleY was undefined');

	state.posX += gameState.menus.inOptions ? Math.min(DELTA_X, 3) : DELTA_X;
    }

    mic.enable();
});
