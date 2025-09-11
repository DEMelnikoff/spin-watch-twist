
// initialize jsPsych
const jsPsych = initJsPsych({
    on_finish: (data) => {
        data.boot = boot;
        if(!boot) {
            document.body.innerHTML = 
                `<div align='center' style="margin: 10%">
                    <p>Thank you for participating!<p>
                    <b>You will be automatically re-directed to Prolific in a few moments.</b>
                </div>`;
            setTimeout(() => { 
                location.href = `https://app.prolific.co/submissions/complete?cc=${completionCode}`
            }, 2000);
        }
    },
});

// set and save subject ID
let subject_id = jsPsych.data.getURLVariable("PROLIFIC_PID");
if (!subject_id) { subject_id = jsPsych.randomization.randomID(10) };
jsPsych.data.addProperties({ subject: subject_id });

// define file name
const filename = `${subject_id}.csv`;

// define completion code for Prolific
const completionCode = "CW0CMZ8Y";

// when true, boot participant from study without redirecting to Prolific
let boot = false;

// function for saving survey data in wide format
const saveSurveyData = (data) => {
    const names = Object.keys(data.response);
    const values = Object.values(data.response);
    for(let i = 0; i < names.length; i++) {
        data[names[i]] = values[i];
    };      
};

const getTotalErrors = (data, correctAnswers) => {
    const answers = Object.values(data.response);
    const errors = answers.map((val, index) => val === correctAnswers[index] ? 0 : 1)
    const totalErrors = errors.reduce((partialSum, a) => partialSum + a, 0);
    return totalErrors;
};

const createSpinner = function(canvas, spinnerData, score, sectors, reliability, interactive) {

  /* get context */
  const ctx = canvas.getContext("2d"); 

  /* flip variables */
  const nFlips = 12 * reliability;
  let flip_array = Array(nFlips).fill(0).concat(Array(12-nFlips).fill(1));
  flip_array = jsPsych.randomization.repeat(flip_array, 1);

  /* get pointer */
  let pointer = document.querySelector("#spinUp");
  pointer.className = "pointUp";

  /* get score message */
  const scoreMsg = document.getElementById("score");

  /* get wheel properties */
  let wheelWidth = canvas.getBoundingClientRect()['width'];
  let wheelHeight = canvas.getBoundingClientRect()['height'];
  let wheelX = canvas.getBoundingClientRect()['x'] + wheelWidth / 2;
  let wheelY = canvas.getBoundingClientRect()['y'] + wheelHeight / 2;
  const tot = sectors.length; // total number of sectors
  const rad = wheelWidth / 2; // radius of wheel
  const PI = Math.PI;
  const arc = (2 * PI) / tot; // arc sizes in radians

  /* state variables */
  let assignment = null;
  let conceal = true;     // wedges hidden ("?") while true
  let stopping = false;   // true only during stop/reveal/finalize
  let rafId = null;
  let oldAngle = 0;
  let currentAngle = 0;

  /* define spinning functions */

  const render = deg => { canvas.style.transform = `rotate(${deg}deg)`; };


  function startCycle() {
    conceal = true;       // mask labels
    stopping = false;

    // Build a random assignment of labels/points to the visible colors
    // (shuffles the sector labels/points independently of color order)
    const payloads = sectors.map(s => ({ label: s.label, points: s.points }));
    assignment = jsPsych.randomization.sampleWithoutReplacement(payloads, payloads.length);

    drawSector(sectors, null);

    const dir = (Math.random() < 0.5 ? 1 : -1);
    const fast = dir * 4;  // brief fast burst
    const coast = dir * 4;  // steady slow/medium
    spinPhase(fast, 500, () => coastIndefinitely(coast));
  }

  function spinPhase(targetSpeed, durationMs, nextPhase) {
    const start = performance.now();
    function step(now) {
      const dt = step.prev ? (now - step.prev) / 1000 : 0;
      step.prev = now;
      oldAngle += targetSpeed * dt * 60;
      currentAngle = oldAngle;
      render(oldAngle);

      const t = now - start;
      if (!stopping && t < durationMs) {
        rafId = requestAnimationFrame(step);
      } else if (!stopping && typeof nextPhase === "function") {
        nextPhase();
      }
    }
    rafId = requestAnimationFrame(step);
  }

  function coastIndefinitely(speed) {
    function step(now) {
      const dt = step.prev ? (now - step.prev) / 1000 : 0;
      step.prev = now;
      oldAngle += speed * dt * 60;
      currentAngle = oldAngle;
      render(oldAngle);
      if (!stopping) rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);
  }

  function finalizeAt(sectorIdx) {
    // Use the random assignment for this cycle
    const chosen = assignment && assignment[sectorIdx] ? assignment[sectorIdx] : { label: "?", points: 0 };
    const points = chosen.points;

    spinnerData.outcomes_points.push(points);
    spinnerData.outcomes_wedges.push(chosen.label); // store revealed label if you want

    drawSector(sectors, sectorIdx);  // revealed view with correct label
    updateScore(points, "black");
  }

  function hardStopAndReveal() {
    if (stopping) return;
    stopping = true;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    currentAngle = oldAngle;
    const idx = getIndex();
    conceal = false;
    drawSector(sectors, idx);   // reveal once here
    finalizeAt(idx);            // record outcome only
  }

  const updateScore = (points, color) => {
    score += points;
    spinnerData.score = score;
    scoreMsg.innerHTML = `<span style="color:${color}; font-weight: bolder">${score}</span>`;
    setTimeout(() => {
      scoreMsg.innerHTML = `${score}`;
      startCycle();
    }, 1200);
  };

  function getIndex(angle = currentAngle) {
    let normAngle = 0;
    const modAngle = angle % 360;
    if (modAngle > 270)      normAngle = 360 - modAngle + 270;
    else if (modAngle < -90) normAngle = -modAngle - 90;
    else                     normAngle = 270 - modAngle;
    return Math.floor(normAngle / (360 / tot));
  }

  //* Draw sectors and prizes texts to canvas */
  function drawSector(sectors, activeIdx) {
    for (let i = 0; i < sectors.length; i++) {
      const ang = arc * i;
      ctx.save();

      // Always show the true color
      ctx.beginPath();
      ctx.fillStyle = sectors[i].color;
      ctx.moveTo(rad, rad);
      ctx.arc(rad, rad, rad, ang, ang + arc);
      ctx.lineTo(rad, rad);
      ctx.fill();

      // Labels
      ctx.translate(rad, rad);
      const rotation = (arc/2) * (1 + 2*i) + Math.PI/2;
      ctx.rotate(rotation);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      ctx.fillStyle = "#fff";

      if (conceal) {
        ctx.font = "bold 72px sans-serif";
        ctx.strokeText("?", 0, -140);
        ctx.fillText("?", 0, -140);
      } else {
        const isActive = (i === activeIdx);
        ctx.font = isActive ? "bolder 90px sans-serif" : "bold 65px sans-serif";
        // ← use the revealed, per-cycle assignment for the label
        const lbl = assignment && assignment[i] ? assignment[i].label : "?";
        ctx.strokeText(lbl, 0, -140);
        ctx.fillText(lbl, 0, -140);
      }
      ctx.restore();
    }
  }

  drawSector(sectors, null);
  startCycle();

  function onKeyDown(e) {
    if (e.code === "Space" || e.keyCode === 32) {
      e.preventDefault();
      if (!stopping) hardStopAndReveal();
    }
  }

  if (interactive) {
    window.addEventListener("keydown", onKeyDown);

  } else {
    setTimeout(startAutoSpin, 1000);
  };

  window.addEventListener('resize', function(event) {
    wheelWidth = canvas.getBoundingClientRect()['width'];
    wheelHeight = canvas.getBoundingClientRect()['height'];
    wheelX = canvas.getBoundingClientRect()['x'] + wheelWidth / 2;
    wheelY = canvas.getBoundingClientRect()['y'] + wheelHeight / 2;
  }, true);

};