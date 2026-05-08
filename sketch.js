// ── shared state ──────────────────────────────────────────────
let buf1 = "";
let buf2 = "";
let buf3 = "";
let buf4 = "";

const BEAT_SLOW   = 214;
const BEAT_MEDIUM = 150;
const BEAT_FAST   = 115;

const SLEEP_SLOW   = BEAT_SLOW / 1000;
const SLEEP_MEDIUM = BEAT_MEDIUM / 1000;
const SLEEP_FAST   = BEAT_FAST / 1000;

const IDLE_MS      = 5000;
const KICK_IDLE_MS = 3000;
const LERP_RATE    = 0.02;

let lastActive1 = -Infinity;
let lastActive2 = -Infinity;
let lastActive3 = -Infinity;
let lastActive4 = -Infinity;
let currentBeat  = BEAT_SLOW;
let targetBeat   = BEAT_SLOW;
let currentSleep = SLEEP_SLOW;
let lastTier     = null;
let sixteenthCount = 0;

// ── CC state tracking ─────────────────────────────────────────
let lastCC1 = null;
let lastCC2 = null;
let lastCC3 = null;
let lastCC4 = null;

function isActive(lastActive, idleMs) {
  return (performance.now() - lastActive) < idleMs;
}

function getActiveCount() {
  return [lastActive1, lastActive2, lastActive3, lastActive4].filter(t => isActive(t, IDLE_MS)).length;
}

function allFourActive() {
  return isActive(lastActive1, IDLE_MS) &&
         isActive(lastActive2, IDLE_MS) &&
         isActive(lastActive3, IDLE_MS) &&
         isActive(lastActive4, IDLE_MS);
}

function kickShouldPlay() {
  return isActive(lastActive1, KICK_IDLE_MS) &&
         isActive(lastActive2, KICK_IDLE_MS) &&
         isActive(lastActive3, KICK_IDLE_MS) &&
         isActive(lastActive4, KICK_IDLE_MS);
}

function getTargetBeat() {
  const count = getActiveCount();
  if (count >= 3) return BEAT_FAST;
  if (count === 2) return BEAT_MEDIUM;
  return BEAT_SLOW;
}

function getTargetSleep() {
  const count = getActiveCount();
  if (count >= 3) return SLEEP_FAST;
  if (count === 2) return SLEEP_MEDIUM;
  return SLEEP_SLOW;
}

// ── master tick ───────────────────────────────────────────────
function sendTick() {
  if (allFourActive() && kickShouldPlay()) {
    if (sixteenthCount % 4 === 0 && midiOut5) {
      midiOut5.send([0x90, 36, 100]);
      setTimeout(() => midiOut5.send([0x80, 36, 0]), currentBeat / 2);
    }
  } else {
    if (midiOut5) midiOut5.send([0x80, 36, 0]);
  }

  sixteenthCount++;
  setTimeout(sendTick, currentBeat);
}

function tickBeatLerp() {
  targetBeat   = getTargetBeat();
  currentBeat += (targetBeat - currentBeat) * LERP_RATE;

  const targetSleep = getTargetSleep();
  currentSleep += (targetSleep - currentSleep) * LERP_RATE;

  const count = getActiveCount();
  if (count !== lastTier) {
    lastTier = count;
    console.log(`tier changed | active: ${count} | target sleep: ${targetSleep}s | target beat: ${getTargetBeat()}ms`);
    serialSend(writer1, String(targetSleep));
    serialSend(writer2, String(targetSleep));
    serialSend(writer3, String(targetSleep));
    serialSend(writer4, String(targetSleep));
  }

  requestAnimationFrame(tickBeatLerp);
}
requestAnimationFrame(tickBeatLerp);

// ── instrument 1 (IAC Driver Bus 1) ───────────────────────────
let midiOut1  = null;
let writer1   = null;
let pixel     = -1;
let lastPixel = -1;
let x = 0, y = 0, z = 0;

// ── instrument 2 (IAC Driver Bus 2) ───────────────────────────
let midiOut2   = null;
let writer2    = null;
let lastLitSet2 = "";

// ── instrument 3 (IAC Driver Bus 3) ───────────────────────────
let midiOut3   = null;
let writer3    = null;
let pixel3     = -1;
let lastPixel3 = -1;
let x3 = 0, y3 = 0, z3 = 0;

// ── instrument 2 (IAC Driver Bus 4) ───────────────────────────
let midiOut4   = null;
let writer4    = null;
let lastLitSet4 = "";

// ── instrument 5 (IAC Driver Bus 5) ───────────────────────────
let midiOut5 = null;

// ── shared scale ──────────────────────────────────────────────
const scale = [43, 45, 47, 48, 50, 52, 49, 54, 69, 71];

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
function toCC(val, inMin, inMax) {
  return Math.round(clamp((val - inMin) / (inMax - inMin), 0, 1) * 127);
}

// ── MIDI setup ────────────────────────────────────────────────
navigator.requestMIDIAccess().then(midi => {
  for (let output of midi.outputs.values()) {
    if (output.name === "IAC Driver Bus 1") { midiOut1 = output; console.log("MIDI out 1 connected:", output.name); }
    if (output.name === "IAC Driver Bus 2") { midiOut2 = output; console.log("MIDI out 2 connected:", output.name); }
    if (output.name === "IAC Driver Bus 3") { midiOut3 = output; console.log("MIDI out 3 connected:", output.name); }
    if (output.name === "IAC Driver Bus 4") { midiOut4 = output; console.log("MIDI out 4 connected:", output.name); }
    if (output.name === "IAC Driver Bus 5") { midiOut5 = output; console.log("MIDI out 5 connected:", output.name); }
  }
  if (!midiOut1) console.warn("IAC Driver Bus 1 not found");
  if (!midiOut2) console.warn("IAC Driver Bus 2 not found");
  if (!midiOut3) console.warn("IAC Driver Bus 3 not found");
  if (!midiOut4) console.warn("IAC Driver Bus 4 not found");
  if (!midiOut5) console.warn("IAC Driver Bus 5 not found");
});

// ── serial ────────────────────────────────────────────────────
async function connectSerial(onDataCallback) {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });

  const decoder = new TextDecoderStream();
  port.readable.pipeTo(decoder.writable);
  decoder.readable.pipeTo(new WritableStream({
    write(chunk) { onDataCallback(chunk); }
  }));

  const encoder = new TextEncoderStream();
  encoder.readable.pipeTo(port.writable);
  const writer = encoder.writable.getWriter();

  return writer;
}

async function serialSend(writer, msg) {
  if (writer) {
    await writer.write(msg + "\n");
  }
}

let tickStarted = false;

function checkAllConnected() {
  if (writer1 && writer2 && writer3 && writer4) {
    console.log("all instruments connected — starting");
    serialSend(writer1, String(SLEEP_SLOW));
    serialSend(writer2, String(SLEEP_SLOW));
    serialSend(writer3, String(SLEEP_SLOW));
    serialSend(writer4, String(SLEEP_SLOW));
    if (!tickStarted) { tickStarted = true; sendTick(); }
  } else {
    const count = [writer1, writer2, writer3, writer4].filter(Boolean).length;
    console.log(`${count}/4 instruments connected`);
  }
}

document.getElementById('serial1').addEventListener('click', async () => {
  writer1 = await connectSerial(onDataInstrument1);
  checkAllConnected();
});
document.getElementById('serial2').addEventListener('click', async () => {
  writer2 = await connectSerial(onDataInstrument2);
  checkAllConnected();
});
document.getElementById('serial3').addEventListener('click', async () => {
  writer3 = await connectSerial(onDataInstrument3);
  checkAllConnected();
});
document.getElementById('serial4').addEventListener('click', async () => {
  writer4 = await connectSerial(onDataInstrument4);
  checkAllConnected();
});

// ── instrument 1 data handler ─────────────────────────────────
function onDataInstrument1(chunk) {
  buf1 += chunk;
  let lines = buf1.split("\n");
  buf1 = lines.pop();

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length === 5 && !line.includes("[")) {
      x = parseFloat(parts[0]);
      y = parseFloat(parts[1]);
      z = parseFloat(parts[2]);
      pixel = parseInt(parts[3]);
      const sleepDuration = parseFloat(parts[4]);

      if (pixel !== lastPixel) {
        lastPixel = pixel;
        lastActive1 = performance.now();

        const midiNote = scale[pixel];
        if (midiOut1) {
          midiOut1.send([0x90, midiNote, 100]);
          midiOut1.send([0xB0, 20, Math.round((pixel / (scale.length - 1)) * 127)]);
          setTimeout(() => midiOut1.send([0x80, midiNote, 0]), currentBeat / 2);
        }
      }

      const ccX = toCC(x, -10, 10);
      const ccY = toCC(y, -10, 10);
      const ccZ = toCC(z, -10, 10);
      const ccKey1 = `${ccX},${ccY},${ccZ}`;

      if (midiOut1) {
        midiOut1.send([0xB0, 21, ccX]);
        midiOut1.send([0xB0, 22, ccY]);
        midiOut1.send([0xB0, 23, ccZ]);
      }

      if (ccKey1 !== lastCC1) {
        lastCC1 = ccKey1;
        console.log(`inst1 cc | x: ${ccX} y: ${ccY} z: ${ccZ} | raw z: ${z.toFixed(2)}`);
      }
    }
  }
}

// ── instrument 2 data handler ─────────────────────────────────
const scaleNotes = [31, 33, 35, 36, 38, 40, 37, 42, 57, 59];

function getScaleNote(pixel) {
  return scaleNotes[pixel % scaleNotes.length] + 12 * Math.floor(pixel / scaleNotes.length);
}

function onDataInstrument2(chunk) {
  buf2 += chunk;
  let lines = buf2.split("\n");
  buf2 = lines.pop();

  for (let line of lines) {
    line = line.trim();

    const match = line.match(/\[([^\]]*)\]/);
    if (!match) continue;

    const sleepMatch = line.match(/\],(.+)$/);
    if (!sleepMatch) continue;
    const afterBracket = sleepMatch[1].trim().split(",");
    const accelZ2 = parseFloat(afterBracket[0]);
    const sleepDuration = parseFloat(afterBracket[1]);
    const beatMs = sleepDuration * 1000;

    const litStr = match[1].trim();
    if (litStr === lastLitSet2) continue;
    lastLitSet2 = litStr;

    const pixels = litStr.length === 0
      ? []
      : litStr.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));

    if (pixels.length > 0) {
      lastActive2 = performance.now();
    }

    const notesToPlay = pixels.map(getScaleNote);
    if (midiOut2) {
      for (const note of notesToPlay) {
        midiOut2.send([0x90, note, 100]);
        setTimeout(() => midiOut2.send([0x80, note, 0]), beatMs / 2);
      }
    }

    const ccZ2 = toCC(accelZ2, -1, 1);

    if (midiOut2) {
      midiOut2.send([0xB0, 27, ccZ2]);
    }

    if (ccZ2 !== lastCC2) {
      lastCC2 = ccZ2;
      console.log(`inst2 cc | z: ${ccZ2} | raw z: ${accelZ2.toFixed(2)}`);
    }
  }
}

// ── instrument 3 data handler ─────────────────────────────────
function onDataInstrument3(chunk) {
  buf3 += chunk;
  let lines = buf3.split("\n");
  buf3 = lines.pop();

  for (let line of lines) {
    line = line.trim();
    const parts = line.split(",");
    if (parts.length === 5 && !line.includes("[")) {
      x3 = parseFloat(parts[0]);
      y3 = parseFloat(parts[1]);
      z3 = parseFloat(parts[2]);
      pixel3 = parseInt(parts[3]);
      const sleepDuration = parseFloat(parts[4]);

      if (pixel3 !== lastPixel3) {
        lastPixel3 = pixel3;
        lastActive3 = performance.now();

        const midiNote = scale[pixel3];
        if (midiOut3) {
          midiOut3.send([0x90, midiNote, 100]);
          midiOut3.send([0xB0, 20, Math.round((pixel3 / (scale.length - 1)) * 127)]);
          setTimeout(() => midiOut3.send([0x80, midiNote, 0]), currentBeat / 2);
        }
      }

      const ccX3 = toCC(x3, -10, 10);
      const ccY3 = toCC(y3, -10, 10);
      const ccZ3 = toCC(z3, -10, 10);
      const ccKey3 = `${ccX3},${ccY3},${ccZ3}`;

      if (midiOut3) {
        midiOut3.send([0xB0, 24, ccX3]);
        midiOut3.send([0xB0, 25, ccY3]);
        midiOut3.send([0xB0, 26, ccZ3]);
      }

      if (ccKey3 !== lastCC3) {
        lastCC3 = ccKey3;
        console.log(`inst3 cc | x: ${ccX3} y: ${ccY3} z: ${ccZ3} | raw z: ${z3.toFixed(2)}`);
      }
    }
  }
}

// ── instrument 4 data handler ─────────────────────────────────
function onDataInstrument4(chunk) {
  buf4 += chunk;
  let lines = buf4.split("\n");
  buf4 = lines.pop();

  for (let line of lines) {
    line = line.trim();

    const match = line.match(/\[([^\]]*)\]/);
    if (!match) continue;

    const sleepMatch = line.match(/\],(.+)$/);
    if (!sleepMatch) continue;
    const afterBracket = sleepMatch[1].trim().split(",");
    const accelZ4 = parseFloat(afterBracket[0]);
    const sleepDuration = parseFloat(afterBracket[1]);
    const beatMs = sleepDuration * 1000;

    const litStr = match[1].trim();
    if (litStr === lastLitSet4) continue;
    lastLitSet4 = litStr;

    const pixels = litStr.length === 0
      ? []
      : litStr.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));

    if (pixels.length > 0) {
      lastActive4 = performance.now();
    }

    const notesToPlay = pixels.map(getScaleNote);
    if (midiOut4) {
      for (const note of notesToPlay) {
        midiOut4.send([0x90, note, 100]);
        setTimeout(() => midiOut4.send([0x80, note, 0]), beatMs / 2);
      }
    }

    const ccZ4 = toCC(accelZ4, -1, 1);

    if (midiOut4) {
      midiOut4.send([0xB0, 28, ccZ4]);
    }

    if (ccZ4 !== lastCC4) {
      lastCC4 = ccZ4;
      console.log(`inst4 cc | z: ${ccZ4} | raw z: ${accelZ4.toFixed(2)}`);
    }
  }
}