
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
  let isVeiled = false; 
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
  let direction;
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
        direction = (speed > 0) ? 1 : -1;
        isAccelerating = true;
        isSpinning = true;
        angVelMax = rand(25, 50);
        giveMoment(speed)
      };
    };   
  };

  const giveMoment = function(initialSpeed) {

    let speed = initialSpeed;
    let lastTimestamp = null;

    function step(timestamp) {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const deltaTime = (timestamp - lastTimestamp) / 1000; // seconds
      lastTimestamp = timestamp;

      // stop accelerating when max speed is reached
      if (Math.abs(speed) >= angVelMax) {
        isAccelerating = false
        isVeiled = true;
        drawSector(sectors, null);
      };

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
          if (animId !== null) {
            cancelAnimationFrame(animId);
            animId = null;
          };
          currentAngle = oldAngle;
          let sectorIdx = getIndex();
          let sector = sectors[sectorIdx];
          let points = sector.points;
          isVeiled = false;
          spinnerData.outcomes_points.push(points);
          spinnerData.outcomes_wedges.push(points);
          drawSector(sectors, sectorIdx, points);
          updateScore(points, "black");
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

  const getIndex = () => {
    let normAngle = 0;
    let modAngle = currentAngle % 360;
    if (modAngle > 270) {
      normAngle = 360 - modAngle + 270;
    } else if (modAngle < -90) { 
      normAngle =  -modAngle - 90;
    } else {
      normAngle = 270 - modAngle;
    }
    let sector = Math.floor(normAngle / (360 / tot))
    return sector
  }

  const drawSector = (sectors, sector) => {

    for (let i = 0; i < sectors.length; i++) {
      const ang = arc * i;
      ctx.save();

      // wedge path
      ctx.beginPath();
      ctx.moveTo(rad, rad);
      ctx.arc(rad, rad, rad, ang, ang + arc);
      ctx.lineTo(rad, rad);
      ctx.closePath();

      // BASE COLOR
      if (isVeiled) {
        ctx.fillStyle = "#777";   // <-- always grey under veil
      } else {
        ctx.fillStyle = (isSpinning && i == sector) ? "black" : sectors[i].color;
      }
      ctx.fill();

      // LABELS: only when the veil is OFF
      if (!isVeiled) {
        ctx.translate(rad, rad);
        let rotation = (arc/2) * (1 + 2*i) + Math.PI/2;
        ctx.rotate(rotation);
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        if (i == sector && sector !== null) {
          ctx.font = "bolder 90px sans-serif";
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 3;
          ctx.strokeText(sectors[i].label, 0, -140);
          ctx.fillText(sectors[i].label, 0, -140);
        } else {
          ctx.font = "bold 65px sans-serif";
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 3;
          ctx.strokeText(sectors[i].label, 0, -140);
          ctx.fillText(sectors[i].label, 0, -140);
        }
      }

      ctx.restore();
    }

    // FULL-WHEEL VEIL overlay
    if (isVeiled) {
      ctx.save();

      // clip to the wheel circle
      ctx.beginPath();
      ctx.arc(rad, rad, rad, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      ctx.translate(rad, rad);

      const numSlices = 8; // adjust for chunkiness: 12, 16, 24...
      const sliceAngle = (2 * Math.PI) / numSlices;

      for (let i = 0; i < numSlices; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rad, i * sliceAngle, (i + 1) * sliceAngle);
        ctx.closePath();

        ctx.fillStyle = (i % 2 === 0) ? '#c00' : '#888'; // red / grey
        ctx.fill();
      }

      ctx.restore();
    }  
  };

  drawSector(sectors, null);

  function startAutoSpin() {
    direction = (Math.random() < 0.5 ? 1 : -1);
    isAccelerating = true;
    isSpinning = true;
    isVeiled = true;
    drawSector(sectors, null);
    angVelMax = rand(25, 50);                   
    let initialSpeed = direction * rand(8, 15);
    giveMoment(initialSpeed);
  };

  if (interactive) {
    /* add event listners */
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