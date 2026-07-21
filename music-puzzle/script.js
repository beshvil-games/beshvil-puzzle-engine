(() => {
  "use strict";

  const config = window.SONG_CONFIG;
  if (!config) throw new Error("SONG_CONFIG is missing");

  const NS = "http://www.w3.org/2000/svg";
  const scoreSvg = document.getElementById("scoreSvg");
  const scoreViewport = document.getElementById("scoreViewport");
  const piano = document.getElementById("piano");
  const statusText = document.getElementById("statusText");

  document.getElementById("game-title").textContent = config.title;
  document.querySelector(".hero p").textContent = config.subtitle;

  const SOLFEGE = {
    C: "דו", D: "רה", E: "מי", F: "פה",
    G: "סול", A: "לה", B: "סי"
  };

  const SEMITONES = {
    C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
    "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11
  };

  const SHARP_AFTER = new Set(["C", "D", "F", "G", "A"]);
  const sampleCache = new Map();
  const activeVoices = new Map();
  const scoreGroups = [];
  let audioContext = null;

  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function parseNote(note) {
    const match = /^([A-G])(#?)(-?\d+)$/.exec(note);
    if (!match) throw new Error(`Invalid note: ${note}`);
    return {
      letter: match[1],
      accidental: match[2],
      octave: Number(match[3]),
      pitch: match[1] + match[2]
    };
  }

  function midiFor(note) {
    const n = parseNote(note);
    return (n.octave + 1) * 12 + SEMITONES[n.pitch];
  }

  function frequencyFor(note) {
    return 440 * Math.pow(2, (midiFor(note) - 69) / 12);
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  }

  function colorFor(note) {
    return config.noteColors[parseNote(note).letter] || "#666";
  }

  function staffY(note) {
    const midi = midiFor(note);
    const e4 = midiFor("E4");
    return 112 - ((midi - e4) * 5);
  }

  function createNoteSymbol(group, x, y, duration) {
    const head = svgEl("ellipse", {
      cx: x, cy: y, rx: 10.2, ry: 7.3,
      transform: `rotate(-18 ${x} ${y})`,
      class: "note-symbol"
    });
    group.appendChild(head);

    const stemUp = y > 76;
    const stemX = stemUp ? x + 8.5 : x - 8.5;
    const stemTop = stemUp ? y - 48 : y + 48;
    const stem = svgEl("line", {
      x1: stemX, y1: y,
      x2: stemX, y2: stemTop,
      stroke: "#171614",
      "stroke-width": 4,
      class: "note-symbol"
    });
    group.appendChild(stem);

    if (duration <= .5) {
      const flag = svgEl("path", {
        d: stemUp
          ? `M ${stemX} ${stemTop} C ${stemX + 23} ${stemTop + 8}, ${stemX + 24} ${stemTop + 27}, ${stemX + 7} ${stemTop + 34}`
          : `M ${stemX} ${stemTop} C ${stemX - 23} ${stemTop - 8}, ${stemX - 24} ${stemTop - 27}, ${stemX - 7} ${stemTop - 34}`,
        fill: "none",
        stroke: "#171614",
        "stroke-width": 5,
        "stroke-linecap": "round",
        class: "note-symbol"
      });
      group.appendChild(flag);
    }

    if (duration >= 2) {
      head.setAttribute("fill", "#fffdf8");
      head.setAttribute("stroke", "#171614");
      head.setAttribute("stroke-width", "3");
    }
  }

  function renderScore() {
    scoreGroups.length = 0;
    scoreSvg.textContent = "";

    const marginLeft = 120;
    const rightPad = 36;
    const weighted = config.melody.reduce(
      (sum, item) => sum + Math.max(.58, item.duration || 1), 0
    );
    const usableWidth = Math.max(650, weighted * 78);
    const width = marginLeft + usableWidth + rightPad;
    const height = 205;

    scoreSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    scoreSvg.setAttribute("width", width);
    scoreSvg.setAttribute("height", height);
    scoreSvg.style.minWidth = `${Math.min(width, 980)}px`;

    for (let i = 0; i < 5; i++) {
      scoreSvg.appendChild(svgEl("line", {
        x1: 20, y1: 72 + i * 14,
        x2: width - 20, y2: 72 + i * 14,
        class: "staff-line"
      }));
    }

    const clef = svgEl("text", { x: 30, y: 138, class: "clef" });
    clef.textContent = "𝄞";
    scoreSvg.appendChild(clef);

    const [top, bottom] = config.timeSignature || [4, 4];
    const topText = svgEl("text", { x: 102, y: 96, class: "time-signature" });
    topText.textContent = top;
    const bottomText = svgEl("text", { x: 102, y: 132, class: "time-signature" });
    bottomText.textContent = bottom;
    scoreSvg.append(topText, bottomText);

    let cursor = marginLeft + 24;
    const unit = usableWidth / weighted;

    config.melody.forEach((item, index) => {
      const span = Math.max(.58, item.duration || 1) * unit;
      const x = cursor + span / 2;
      const y = staffY(item.note);
      const group = svgEl("g", {
        class: "note-group",
        "data-index": index,
        "data-note": item.note
      });

      createNoteSymbol(group, x, y, item.duration || 1);

      const dot = svgEl("circle", {
        cx: x, cy: 170, r: 8.5,
        fill: colorFor(item.note),
        class: "note-dot",
        style: `color:${colorFor(item.note)}`
      });
      group.appendChild(dot);
      scoreSvg.appendChild(group);
      scoreGroups.push(group);

      cursor += span;

      if (item.measureEnd) {
        scoreSvg.appendChild(svgEl("line", {
          x1: cursor + 3, y1: 69,
          x2: cursor + 3, y2: 131,
          class: "bar-line"
        }));
      }
    });

    scoreSvg.appendChild(svgEl("line", {
      x1: width - 29, y1: 68,
      x2: width - 29, y2: 132,
      class: "bar-line"
    }));
    scoreSvg.appendChild(svgEl("line", {
      x1: width - 22, y1: 68,
      x2: width - 22, y2: 132,
      class: "bar-line",
      "stroke-width": 5
    }));
  }

  function keyboardNotes() {
    const result = [];
    const start = Number(config.startOctave || 4);
    const octaves = Math.max(1, Number(config.octaves || 2));

    for (let octave = start; octave < start + octaves; octave++) {
      ["C","D","E","F","G","A","B"].forEach(letter => {
        result.push(`${letter}${octave}`);
      });
    }
    return result;
  }

  function renderPiano() {
    piano.textContent = "";
    const whiteNotes = keyboardNotes();
    piano.style.setProperty("--white-count", whiteNotes.length);

    whiteNotes.forEach((note, index) => {
      const { letter, octave } = parseNote(note);
      const key = document.createElement("button");
      key.type = "button";
      key.className = "key white";
      key.style.left = `calc(${index} * (100% / ${whiteNotes.length}))`;
      key.dataset.note = note;
      key.setAttribute("aria-label", `${SOLFEGE[letter]} ${octave}`);

      const label = document.createElement("span");
      label.className = "key-label";
      label.innerHTML =
        `<span class="key-dot" style="background:${colorFor(note)}"></span>` +
        `<span>${SOLFEGE[letter]}</span>`;
      key.appendChild(label);
      attachKeyEvents(key);
      piano.appendChild(key);

      if (SHARP_AFTER.has(letter) && index < whiteNotes.length - 1) {
        const black = document.createElement("button");
        black.type = "button";
        black.className = "key black";
        black.style.left = `calc(${index + 1} * (100% / ${whiteNotes.length}))`;
        black.dataset.note = `${letter}#${octave}`;
        black.setAttribute("aria-label", `${SOLFEGE[letter]} דיאז ${octave}`);
        attachKeyEvents(black);
        piano.appendChild(black);
      }
    });
  }

  function noteFilename(note) {
    return `${note.replace("#", "s")}.mp3`;
  }

  async function loadSample(note) {
    if (sampleCache.has(note)) return sampleCache.get(note);
    const ctx = getAudioContext();

    const promise = fetch(config.pianoSamplesBaseUrl + noteFilename(note), {
      mode: "cors",
      cache: "force-cache"
    })
      .then(response => {
        if (!response.ok) throw new Error("sample unavailable");
        return response.arrayBuffer();
      })
      .then(buffer => ctx.decodeAudioData(buffer));

    sampleCache.set(note, promise);
    return promise;
  }

  function fallbackPiano(note, velocity = .72) {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3400, now);
    filter.Q.value = .7;

    master.gain.setValueAtTime(.0001, now);
    master.gain.exponentialRampToValueAtTime(.22 * velocity, now + .008);
    master.gain.exponentialRampToValueAtTime(.085 * velocity, now + .14);
    master.gain.exponentialRampToValueAtTime(.0001, now + 1.7);

    [1, 2, 3].forEach((harmonic, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.value = frequencyFor(note) * harmonic;
      gain.gain.value = [1, .17, .06][i];
      osc.connect(gain).connect(filter);
      osc.start(now);
      osc.stop(now + 1.75);
    });

    filter.connect(master).connect(ctx.destination);
    return { stop: () => master.gain.cancelScheduledValues(ctx.currentTime) };
  }

  async function playNote(note, keyElement) {
    const ctx = getAudioContext();
    keyElement?.classList.add("is-active");

    try {
      const buffer = await loadSample(note);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = .82;
      source.connect(gain).connect(ctx.destination);
      source.start();
      activeVoices.set(note, source);
      source.onended = () => activeVoices.delete(note);
    } catch {
      activeVoices.set(note, fallbackPiano(note));
    }

    highlightMatchingScoreNote(note);
  }

  function releaseNote(note, keyElement) {
    keyElement?.classList.remove("is-active");
    window.setTimeout(() => activeVoices.delete(note), 50);
  }

  function highlightMatchingScoreNote(note) {
    const candidates = scoreGroups.filter(
      group => group.dataset.note === note && !group.classList.contains("is-playing")
    );
    const group = candidates[0] || scoreGroups.find(g => g.dataset.note === note);
    if (!group) return;

    group.classList.add("is-playing");
    group.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    window.setTimeout(() => group.classList.remove("is-playing"), 280);
  }

  function attachKeyEvents(key) {
    const down = event => {
      event.preventDefault();
      key.setPointerCapture?.(event.pointerId);
      playNote(key.dataset.note, key);
    };
    const up = event => {
      event.preventDefault();
      releaseNote(key.dataset.note, key);
    };

    key.addEventListener("pointerdown", down);
    key.addEventListener("pointerup", up);
    key.addEventListener("pointercancel", up);
    key.addEventListener("pointerleave", event => {
      if (event.buttons) releaseNote(key.dataset.note, key);
    });

    key.addEventListener("keydown", event => {
      if ((event.key === " " || event.key === "Enter") && !event.repeat) {
        event.preventDefault();
        playNote(key.dataset.note, key);
      }
    });
    key.addEventListener("keyup", event => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        releaseNote(key.dataset.note, key);
      }
    });
  }

  // מיפוי מקלדת מחשב לשתי אוקטבות
  const COMPUTER_KEYS = "awsedftgyhujkolp;";
  const allKeys = () => [...piano.querySelectorAll(".key")];

  window.addEventListener("keydown", event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const index = COMPUTER_KEYS.indexOf(event.key.toLowerCase());
    if (index < 0) return;
    const key = allKeys()[index];
    if (key) {
      event.preventDefault();
      playNote(key.dataset.note, key);
    }
  });

  window.addEventListener("keyup", event => {
    const index = COMPUTER_KEYS.indexOf(event.key.toLowerCase());
    if (index < 0) return;
    const key = allKeys()[index];
    if (key) releaseNote(key.dataset.note, key);
  });

  renderScore();
  renderPiano();

  statusText.textContent =
    "לחצו על הקלידים כדי לנגן • במחשב אפשר גם להשתמש במקלדת";
})();
