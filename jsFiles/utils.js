
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

  /* spin dynamics */
  const friction = 0.975;  // 0.995=soft, 0.99=mid, 0.98=hard
  const angVelMin = 5; // Below that number will be treated as a stop
  let angVelMax = 0; // Random ang.vel. to acceletare to 
  let angVel = 0;    // Current angular velocity

  /* state variables */
  let isGrabbed = false;       // true when wheel is grabbed, false otherwise
  let isDragging = false;      // true when wheel is being dragged, false otherwise
  let isSpinning = false;      // true when wheel is spinning, false otherwise
  let isAccelerating = false;  // true when wheel is accelerating, false otherwise
  let lastAngles = [0,0,0];    // store the last three angles
  let correctSpeed = [0]       // speed corrected for 360-degree limit
  let startAngle = null;       // angle of grab
  let oldAngle = 0;            // wheel angle prior to last perturbation
  let oldAngle_corrected;
  let currentAngle = null;     // wheel angle after last perturbation
  let onWheel = false;         // true when cursor is on wheel, false otherwise
  let spin_num = 5             // number of spins
  let liveSectorLabel;
  let animId = null;          // current requestAnimationFrame handle

  /* define spinning functions */

  const onGrab = (x, y) => {
    if (!isSpinning) {
      canvas.style.cursor = "grabbing";
      isGrabbed = true;
      startAngle = calculateAngle(x, y);
    };
  };

  const calculateAngle =  (currentX, currentY) => {
    let xLength = currentX - wheelX;
    let yLength = currentY - wheelY;
    let angle = Math.atan2(xLength, yLength) * (180/Math.PI);
    return 360 - angle;
  };

  const onMove = (x, y) => {
    if(isGrabbed) {
      canvas.style.cursor = "grabbing";
      isDragging = true;
    };
    if(!isDragging)
      return
    lastAngles.shift();
    let deltaAngle = calculateAngle(x, y) - startAngle;
    currentAngle = deltaAngle + oldAngle;
    lastAngles.push(currentAngle);
    let speed = lastAngles[2] - lastAngles[0];
    if (Math.abs(speed) < 200) {
      correctSpeed.shift();
      correctSpeed.push(speed);
    };
    render(currentAngle);
  };

  const render = (deg) => {
    canvas.style.transform = `rotate(${deg}deg)`;
  };


  const onRelease = function() {
    isGrabbed = false;
    if(isDragging){
      isDragging = false;
      oldAngle = currentAngle;
      let speed = correctSpeed[0];
      if (Math.abs(speed) > angVelMin) {
        let direction = (speed > 0) ? 1 : -1;
        isAccelerating = true;
        isSpinning = true;
        angVelMax = rand(25, 50);
        giveMoment(speed)
      };
    };   
  };

  // finalize outcome for a given sector index (push + draw + score)
  function finalizeAt(sectorIdx) {
    const sector = sectors[sectorIdx];
    const points = sector.points; // adjust if your 'points' can be arrays elsewhere
    spinnerData.outcomes_points.push(points);
    spinnerData.outcomes_wedges.push(sector.points); // or sector.label if that's what you store
    drawSector(sectors, sectorIdx, points);
    updateScore(points, "black");
  }

  // animate a short swivel from currentAngle to the target index
  function swivelToIndex(targetIdx, duration = 500) {
    const startAngle = currentAngle;
    const arcDeg = 360 / tot;

    // Find a small integer multiple of arcDeg that lands exactly on targetIdx
    let bestK = 0;
    for (let k = -tot; k <= tot; k++) {
      if (getIndex(startAngle + k * arcDeg) === targetIdx) { bestK = k; break; }
    }
    const endAngle = startAngle + bestK * arcDeg;

    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

    function tick(tsStart) {
      return function rafStep(ts) {
        const p = Math.min(1, (ts - tsStart) / duration);
        const eased = easeOutCubic(p);
        const ang = startAngle + (endAngle - startAngle) * eased;
        currentAngle = oldAngle = ang;
        render(ang);
        if (p < 1) requestAnimationFrame(rafStep);
        else finalizeAt(targetIdx);
      };
    }
    requestAnimationFrame(tick(performance.now()));
  }

  const giveMoment = function(initialSpeed) {

    let speed = initialSpeed;
    let lastTimestamp = null;

    function step(timestamp) {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const deltaTime = (timestamp - lastTimestamp) / 1000; // seconds
      lastTimestamp = timestamp;

      // stop accelerating when max speed is reached
      if (Math.abs(speed) >= angVelMax) { isAccelerating = false } ;

      let liveSector = sectors[getIndex(oldAngle)];
      liveSectorLabel = liveSector.label;
      oldAngle_corrected = (oldAngle < 0) ? 360 + (oldAngle % 360) : oldAngle % 360;


      // accelerate
      if (isAccelerating) {
        let growthRate = Math.log(1.06) * 60;
        speed *= Math.exp(growthRate * deltaTime);
        animId = requestAnimationFrame(step);
        oldAngle += speed * deltaTime * 60;
        lastAngles.shift();
        lastAngles.push(oldAngle);
        render(oldAngle);
      }
      
      // decelerate and stop
      else {
        let decayRate = Math.log(friction) * 60; // friction < 1, so log is negative
        isAccelerating = false;
        speed *= Math.exp(decayRate * deltaTime); // Exponential decay
        animId = requestAnimationFrame(step);
        if (Math.abs(speed) > angVelMin * .1) {
          // decelerate
          oldAngle += speed * deltaTime * 60;
          lastAngles.shift();
          lastAngles.push(oldAngle);
          render(oldAngle);       
        } else {
          // stop spinner
          speed = 0;
          if (animId !== null) { cancelAnimationFrame(animId); animId = null; }
          currentAngle = oldAngle;
          let sectorIdx = getIndex();
          let flip = flip_array.pop();
          if (flip == 1) {
            const offsetChoices = [2, 2, 2];
            const offset = offsetChoices[Math.floor(Math.random() * offsetChoices.length)];
            const targetIdx = (sectorIdx + offset) % tot;
            swivelToIndex(targetIdx, 500); // 300–700ms feels snappy; tweak as you like
          } else {
            finalizeAt(sectorIdx);
          };
        };
      };
    };
    animId = requestAnimationFrame(step);
  };

  /* generate random float in range min-max */
  const rand = (m, M) => Math.random() * (M - m) + m;

  const updateScore = (points, color) => {
    score += points;
    spinnerData.score = score;
    scoreMsg.innerHTML = `<span style="color:${color}; font-weight: bolder">${score}</span>`;
    setTimeout(() => {
      scoreMsg.innerHTML = `${score}`
      isSpinning = (spinnerData.outcomes_points.length >= 12) ? true : false;
      drawSector(sectors, null);
      onWheel ? canvas.style.cursor = "grab" : canvas.style.cursor = "";
      if (!interactive && spinnerData.outcomes_points.length < 12) { setTimeout(startAutoSpin, 1000) };
    }, 1250);
  };

  const getIndex = (angle = currentAngle) => {
    let normAngle = 0;
    let modAngle = angle % 360;
    if (modAngle > 270) {
      normAngle = 360 - modAngle + 270;
    } else if (modAngle < -90) { 
      normAngle = -modAngle - 90;
    } else {
      normAngle = 270 - modAngle;
    }
    return Math.floor(normAngle / (360 / tot));
  };

  //* Draw sectors and prizes texts to canvas */
  const drawSector = (sectors, sector) => {
    for (let i = 0; i < sectors.length; i++) {
      const ang = arc * i;
      ctx.save();
      // COLOR
      ctx.beginPath();
      ctx.fillStyle = (isSpinning && i == sector) ? "black" : sectors[i].color;
      ctx.moveTo(rad, rad);
      ctx.arc(rad, rad, rad, ang, ang + arc);
      ctx.lineTo(rad, rad);
      ctx.fill();
      // TEXT
      ctx.translate(rad, rad);
      let rotation = (arc/2) * (1 + 2*i) + Math.PI/2
      ctx.rotate( rotation );


      //ctx.rotate( (ang + arc / 2) + arc );
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      if (isSpinning && i == sector) {
        ctx.font = "bolder 90px sans-serif"
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(sectors[i].label, 0, -140);
        ctx.fillText(sectors[i].label, 0, -140);
      } else {
        ctx.font = "bold 65px sans-serif"
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(sectors[i].label, 0, -140);
        ctx.fillText(sectors[i].label, 0, -140);
      }
      ctx.restore();
    }
  };

  drawSector(sectors, null);

  function startAutoSpin() {
    direction = (Math.random() < 0.5 ? 1 : -1);
    isAccelerating = true;
    isSpinning = true;
    angVelMax = rand(25, 50);                   
    let initialSpeed = direction * rand(8, 15);
    giveMoment(initialSpeed);
  };

  if (interactive) {
    canvas.addEventListener('mousedown', function(e) {
        if (onWheel) { onGrab(e.clientX, e.clientY) };
    });

    canvas.addEventListener('mousemove', function(e) {
        let dist = Math.sqrt( (wheelX - e.clientX)**2 + (wheelY - e.clientY)**2 );
        dist < rad ? onWheel = true : onWheel = false;
        onWheel && !isGrabbed && !isSpinning ? canvas.style.cursor = "grab" : canvas.style.cursor = "";
        if(isGrabbed && onWheel) { onMove(e.clientX, e.clientY) };
    });

    window.addEventListener('mouseup', onRelease);
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