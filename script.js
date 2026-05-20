// ── shared state ──────────────────────────────────────────────
let buf1 = "";
let buf2 = "";
let buf3 = "";
let buf4 = "";

const BEAT = 115;

// ── CC state tracking ─────────────────────────────────────────
let lastCC1 = null;
let lastCC2 = null;
let lastCC3 = null;
let lastCC4 = null;

// ── instruments ───────────────────────────────────────────────
let midiOut1 = null; let writer1 = null;
let midiOut2 = null; let writer2 = null;
let midiOut3 = null; let writer3 = null;
let midiOut4 = null; let writer4 = null;

let pixel  = -1; let lastPixel  = -1; let z  = 0;
let pixel2 = -1; let lastPixel2 = -1; let z2 = 0;
let pixel3 = -1; let lastPixel3 = -1; let z3 = 0;
let pixel4 = -1; let lastPixel4 = -1; let z4 = 0;

const scale  = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57];
const scale1 = [40, 47, 50, 52, 54, 55, 59, 62, 64, 66];

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
  }
  if (!midiOut1) console.warn("IAC Driver Bus 1 not found");
  if (!midiOut2) console.warn("IAC Driver Bus 2 not found");
  if (!midiOut3) console.warn("IAC Driver Bus 3 not found");
  if (!midiOut4) console.warn("IAC Driver Bus 4 not found");
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

function checkAllConnected() {
  if (writer1 && writer2 && writer3 && writer4) {
    console.log("all instruments connected");
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
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      z = parseFloat(parts[2]);
      pixel = parseInt(parts[3]);

      if (pixel !== lastPixel) {
        lastPixel = pixel;
        const midiNote = scale1[pixel];
        if (midiOut1) {
          midiOut1.send([0x90, midiNote, 100]);
          midiOut1.send([0xB0, 20, Math.round((pixel / (scale1.length - 1)) * 127)]);
          setTimeout(() => midiOut1.send([0x80, midiNote, 0]), BEAT / 2);
        }
        if (writerLCD1) serialSend(writerLCD1, `n,${pixel}`);
      }

      if (writerLCD1) serialSend(writerLCD1, `z,${z.toFixed(2)}`);

      const ccZ = toCC(z, -10, 10);
      if (midiOut1) {
        midiOut1.send([0xB0, 13, ccZ]);
      }
      if (ccZ !== lastCC1) {
        lastCC1 = ccZ;
        console.log(`inst1 cc | z: ${ccZ} | raw z: ${z.toFixed(2)}`);
      }
    }
  }
}

// ── instrument 2 data handler ─────────────────────────────────
function onDataInstrument2(chunk) {
  buf2 += chunk;
  let lines = buf2.split("\n");
  buf2 = lines.pop();

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length === 5 && !line.includes("[")) {
      const x2 = parseFloat(parts[0]);
      const y2 = parseFloat(parts[1]);
      z2 = parseFloat(parts[2]);
      pixel2 = parseInt(parts[3]);

      if (pixel2 !== lastPixel2) {
        lastPixel2 = pixel2;
        const midiNote = scale[pixel2];
        if (midiOut2) {
          midiOut2.send([0x90, midiNote, 100]);
          midiOut2.send([0xB0, 20, Math.round((pixel2 / (scale.length - 1)) * 127)]);
          setTimeout(() => midiOut2.send([0x80, midiNote, 0]), BEAT / 2);
        }
        if (writerLCD2) serialSend(writerLCD2, `n,${pixel2}`);
      }

      if (writerLCD2) serialSend(writerLCD2, `z,${z2.toFixed(2)}`);

      const ccZ2 = toCC(z2, -10, 10);
      if (midiOut2) {
        midiOut2.send([0xB0, 23, ccZ2]);
      }
      if (ccZ2 !== lastCC2) {
        lastCC2 = ccZ2;
        console.log(`inst2 cc | z: ${ccZ2} | raw z: ${z2.toFixed(2)}`);
      }
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
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length === 5 && !line.includes("[")) {
      const x3 = parseFloat(parts[0]);
      const y3 = parseFloat(parts[1]);
      z3 = parseFloat(parts[2]);
      pixel3 = parseInt(parts[3]);

      if (pixel3 !== lastPixel3) {
        lastPixel3 = pixel3;
        const midiNote = scale1[pixel3];
        if (midiOut3) {
          midiOut3.send([0x90, midiNote, 100]);
          midiOut3.send([0xB0, 20, Math.round((pixel3 / (scale1.length - 1)) * 127)]);
          setTimeout(() => midiOut3.send([0x80, midiNote, 0]), BEAT / 2);
        }
        if (writerLCD3) serialSend(writerLCD3, `n,${pixel3}`);
      }

      if (writerLCD3) serialSend(writerLCD3, `z,${z3.toFixed(2)}`);

      const ccZ3 = toCC(z3, -10, 10);
      if (midiOut3) {
        midiOut3.send([0xB0, 33, ccZ3]);
      }
      if (ccZ3 !== lastCC3) {
        lastCC3 = ccZ3;
        console.log(`inst3 cc | z: ${ccZ3} | raw z: ${z3.toFixed(2)}`);
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
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length === 5 && !line.includes("[")) {
      const x4 = parseFloat(parts[0]);
      const y4 = parseFloat(parts[1]);
      z4 = parseFloat(parts[2]);
      pixel4 = parseInt(parts[3]);

      if (pixel4 !== lastPixel4) {
        lastPixel4 = pixel4;
        const midiNote = scale[pixel4];
        if (midiOut4) {
          midiOut4.send([0x90, midiNote, 100]);
          midiOut4.send([0xB0, 20, Math.round((pixel4 / (scale.length - 1)) * 127)]);
          setTimeout(() => midiOut4.send([0x80, midiNote, 0]), BEAT / 2);
        }
        if (writerLCD4) serialSend(writerLCD4, `n,${pixel4}`);
      }

      if (writerLCD4) serialSend(writerLCD4, `z,${z4.toFixed(2)}`);

      const ccZ4 = toCC(z4, -10, 10);
      if (midiOut4) {
        midiOut4.send([0xB0, 43, ccZ4]);
      }
      if (ccZ4 !== lastCC4) {
        lastCC4 = ccZ4;
        console.log(`inst4 cc | z: ${ccZ4} | raw z: ${z4.toFixed(2)}`);
      }
    }
  }
}

// ── LCD displays ──────────────────────────────────────────────
let writerLCD1 = null;
let writerLCD2 = null;
let writerLCD3 = null;
let writerLCD4 = null;

function onDataLCD(chunk) {}

document.getElementById('serialLCD1').addEventListener('click', async () => {
  writerLCD1 = await connectSerial(onDataLCD);
  console.log("LCD 1 connected");
});
document.getElementById('serialLCD2').addEventListener('click', async () => {
  writerLCD2 = await connectSerial(onDataLCD);
  console.log("LCD 2 connected");
});
document.getElementById('serialLCD3').addEventListener('click', async () => {
  writerLCD3 = await connectSerial(onDataLCD);
  console.log("LCD 3 connected");
});
document.getElementById('serialLCD4').addEventListener('click', async () => {
  writerLCD4 = await connectSerial(onDataLCD);
  console.log("LCD 4 connected");
});

navigator.serial.addEventListener('connect', async (e) => {
  const port = e.target;
  console.log("device plugged in — press button A to identify");

  await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second

  try {
    await port.open({ baudRate: 9600 });
  } catch(e) {
    console.log("port open error:", e);
    return;
  }

  const encoder = new TextEncoderStream();
  encoder.readable.pipeTo(port.writable);
  const portWriter = encoder.writable.getWriter();

  let buf = "";
  let identified = false;
  let assignedHandler = null;

  const decoder = new TextDecoderStream();
  port.readable.pipeTo(decoder.writable);
  decoder.readable.pipeTo(new WritableStream({
    write(chunk) {
      buf += chunk;
      let lines = buf.split("\n");
      buf = lines.pop();

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.startsWith("DEVICE:")) {
          const name = line.replace("DEVICE:", "").trim();
          console.log(`identified: ${name}`);
          identified = true;

          if (name === "inst1") { writer1 = portWriter; assignedHandler = onDataInstrument1; console.log("inst1 reconnected"); }
          else if (name === "inst2") { writer2 = portWriter; assignedHandler = onDataInstrument2; console.log("inst2 reconnected"); }
          else if (name === "inst3") { writer3 = portWriter; assignedHandler = onDataInstrument3; console.log("inst3 reconnected"); }
          else if (name === "inst4") { writer4 = portWriter; assignedHandler = onDataInstrument4; console.log("inst4 reconnected"); }
          continue;
        }

        if (identified && assignedHandler) {
          assignedHandler(line + "\n");
        }
      }
    }
  }));
});

navigator.serial.addEventListener('disconnect', (e) => {
  console.log("device disconnected — plug it back in and press button A");
  if (writer1 && e.target === writer1._port) writer1 = null;
  if (writer2 && e.target === writer2._port) writer2 = null;
  if (writer3 && e.target === writer3._port) writer3 = null;
  if (writer4 && e.target === writer4._port) writer4 = null;
});