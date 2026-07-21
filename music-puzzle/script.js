(() => {
  "use strict";

  const config = window.SONG_CONFIG;
  if (!config) throw new Error("SONG_CONFIG is missing");

  const NS = "http://www.w3.org/2000/svg";
  const score = document.getElementById("score");
  const piano = document.getElementById("piano");
  const statusText = document.getElementById("statusText");

  document.getElementById("gameTitle").textContent = config.title;
  document.getElementById("gameSubtitle").textContent = config.subtitle;

  const SOLFEGE = {
    C: "דו", D: "רה", E: "מי", F: "פה",
    G: "סול", A: "לה", B: "סי"
  };

  const WHITE_NOTES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"];
  const BLACK_NOTES = [
    { note: "Cs4", after: 1 },
    { note: "Ds4", after: 2 },
    { note: "Fs4", after: 4 },
    { note: "Gs4", after: 5 },
    { note: "As4", after: 6 }
  ];

  const DIATONIC_INDEX = {
    C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6
  };

  const audioCache = new Map();
  const renderedNotes = [];
  const renderedDots = [];
  let progressIndex = 0;

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
    return el;
  }

  function parseNote(note) {
    const normalized = note.replace("s", "#");
    const match = /^([A-G])(#?)(\d+)$/.exec(normalized);

    if (!match) {
      throw new Error(`Invalid note: ${note}`);
    }

    return {
      letter: match[1],
      accidental: match[2],
      octave: Number(match[3])
    };
  }

  function colorFor(note) {
    return config.noteColors[parseNote(note).letter];
  }

  function staffStep(note) {
    const parsed = parseNote(note);
    return (parsed.octave - 4) * 7 + DIATONIC_INDEX[parsed.letter];
  }

  function noteY(note) {
    // E4 נמצא על הקו התחתון.
    const e4Step = DIATONIC_INDEX.E;
    return 120 - (staffStep(note) - e4Step) * 7;
  }

  function addLedgerLines(group, x, y) {
    if (y >= 134) {
      for (let lineY = 134; lineY <= y + 1; lineY += 14) {
        group.appendChild(svgEl("line", {
          x1: x - 15,
          y1: lineY,
          x2: x + 15,
          y2: lineY,
          stroke: "#1b1a18",
          "stroke-width": 1.8
        }));
      }
    }

    if (y <= 64) {
      for (let lineY = 64; lineY >= y - 1; lineY -= 14) {
        group.appendChild(svgEl("line", {
          x1: x - 15,
          y1: lineY,
          x2: x + 15,
          y2: lineY,
          stroke: "#1b1a18",
          "stroke-width": 1.8
        }));
      }
    }
  }

  function drawQuarterNote(parent, x, y, index) {
    const group = svgEl("g", {
      class: "vf-note",
      "data-index": index
    });

    addLedgerLines(group, x, y);

    const stemUp = y >= 92;
    const stemX = stemUp ? x + 8 : x - 8;
    const stemEndY = stemUp ? y - 42 : y + 42;

    group.appendChild(svgEl("ellipse", {
      cx: x,
      cy: y,
      rx: 9.5,
      ry: 6.6,
      transform: `rotate(-18 ${x} ${y})`,
      fill: "#161513"
    }));

    group.appendChild(svgEl("line", {
      x1: stemX,
      y1: y,
      x2: stemX,
      y2: stemEndY,
      stroke: "#161513",
      "stroke-width": 3.2,
      "stroke-linecap": "round"
    }));

    parent.appendChild(group);
    renderedNotes.push(group);
  }

  function renderScore() {
    score.textContent = "";
    renderedNotes.length = 0;
    renderedDots.length = 0;

    const noteSpacing = 61;
    const startX = 112;
    const width = Math.max(720, startX + config.melody.length * noteSpacing + 45);
    const height = 195;

    score.style.width = `${width}px`;

    const svg = svgEl("svg", {
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: "img",
      "aria-label": "תווי המנגינה"
    });

    // חמשת קווי החמשה
    for (let i = 0; i < 5; i++) {
      const y = 64 + i * 14;
      svg.appendChild(svgEl("line", {
        x1: 24,
        y1: y,
        x2: width - 24,
        y2: y,
        stroke: "#25231f",
        "stroke-width": 1.7
      }));
    }

    // משקל
    const [top, bottom] = config.timeSignature || [2, 4];

    const topText = svgEl("text", {
      x: 55,
      y: 89,
      "text-anchor": "middle",
      "font-family": "Georgia, serif",
      "font-size": 29,
      "font-weight": 700,
      fill: "#181715"
    });
    topText.textContent = top;

    const bottomText = svgEl("text", {
      x: 55,
      y: 121,
      "text-anchor": "middle",
      "font-family": "Georgia, serif",
      "font-size": 29,
      "font-weight": 700,
      fill: "#181715"
    });
    bottomText.textContent = bottom;

    svg.append(topText, bottomText);

    config.melody.forEach((item, index) => {
      const x = startX + index * noteSpacing;
      const y = noteY(item.note);

      drawQuarterNote(svg, x, y, index);

      const dot = svgEl("circle", {
        cx: x,
        cy: 164,
        r: 8.5,
        fill: colorFor(item.note),
        stroke: "#fff",
        "stroke-width": 2.5,
        class: "note-color-dot",
        style: `color:${colorFor(item.note)}`,
        "data-index": index
      });

      svg.appendChild(dot);
      renderedDots.push(dot);

      if (item.measureEnd) {
        svg.appendChild(svgEl("line", {
          x1: x + noteSpacing / 2,
          y1: 60,
          x2: x + noteSpacing / 2,
          y2: 124,
          stroke: "#25231f",
          "stroke-width": 1.8
        }));
      }
    });

    svg.appendChild(svgEl("line", {
      x1: width - 33,
      y1: 60,
      x2: width - 33,
      y2: 124,
      stroke: "#25231f",
      "stroke-width": 1.8
    }));

    svg.appendChild(svgEl("line", {
      x1: width - 26,
      y1: 60,
      x2: width - 26,
      y2: 124,
      stroke: "#25231f",
      "stroke-width": 4
    }));

    score.appendChild(svg);
    updateCurrentNote();
  }

  function createKey(note, type, left) {
    const key = document.createElement("button");
    key.type = "button";
    key.className = `key ${type}`;
    key.dataset.note = note;
    key.style.left = left;
    key.setAttribute("aria-label", note);

    if (type === "white") {
      const letter = parseNote(note).letter;
      const label = document.createElement("span");
      label.className = "key-label";
      label.innerHTML =
        `<span class="key-dot" style="background:${colorFor(note)}"></span>` +
        `<span>${SOLFEGE[letter]}</span>`;
      key.appendChild(label);
    }

    const press = event => {
      event.preventDefault();
      key.setPointerCapture?.(event.pointerId);
      key.classList.add("is-active");
      playSound(note);
      handleGameNote(note);
    };

    const release = event => {
      event.preventDefault();
      key.classList.remove("is-active");
    };

    key.addEventListener("pointerdown", press);
    key.addEventListener("pointerup", release);
    key.addEventListener("pointercancel", release);
    key.addEventListener("pointerleave", release);

    return key;
  }

  function renderPiano() {
    piano.textContent = "";
    piano.style.setProperty("--white-count", 7);

    WHITE_NOTES.forEach((note, index) => {
      piano.appendChild(
        createKey(note, "white", `calc(${index} * (100% / 7))`)
      );
    });

    BLACK_NOTES.forEach(item => {
      piano.appendChild(
        createKey(item.note, "black", `calc(${item.after} * (100% / 7))`)
      );
    });
  }

  function playSound(note) {
    let audio = audioCache.get(note);

    if (!audio) {
      audio = new Audio(`audio/${note}.wav`);
      audio.preload = "auto";
      audioCache.set(note, audio);
    }

    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.88;
    audio.play().catch(() => {});
  }

  function handleGameNote(note) {
    const expected = config.melody[progressIndex]?.note;
    if (!expected) return;

    const normalizedNote = note.replace("s", "#");

    if (normalizedNote === expected) {
      const noteElement = renderedNotes[progressIndex];
      const dot = renderedDots[progressIndex];

      dot?.classList.remove("is-current");
      noteElement?.classList.add("is-playing");
      dot?.classList.add("is-playing");

      setTimeout(() => {
        noteElement?.classList.remove("is-playing");
        noteElement?.classList.add("is-done");
        dot?.classList.remove("is-playing");
        dot?.classList.add("is-done");
      }, 300);

      progressIndex++;

      if (progressIndex >= config.melody.length) {
        statusText.textContent = "כל הכבוד! ניגנתם את המנגינה";
        setTimeout(resetGame, 1800);
      } else {
        updateCurrentNote();
      }
    } else {
      statusText.textContent = "נסו שוב לפי העיגול הבא";

      setTimeout(() => {
        if (progressIndex < config.melody.length) {
          statusText.textContent = "לחצו על הקלידים לפי סדר התווים";
        }
      }, 900);
    }
  }

  function updateCurrentNote() {
    renderedDots.forEach((dot, index) => {
      dot.classList.toggle("is-current", index === progressIndex);
    });

    renderedDots[progressIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  }

  function resetGame() {
    progressIndex = 0;

    renderedDots.forEach(dot => {
      dot.classList.remove("is-playing", "is-done", "is-current");
    });

    renderedNotes.forEach(note => {
      note.classList.remove("is-playing", "is-done");
    });

    statusText.textContent = "לחצו על הקלידים לפי סדר התווים";
    updateCurrentNote();
  }

  renderPiano();
  renderScore();

  [...WHITE_NOTES, ...BLACK_NOTES.map(item => item.note)].forEach(note => {
    const audio = new Audio(`audio/${note}.wav`);
    audio.preload = "auto";
    audioCache.set(note, audio);
  });
})();
