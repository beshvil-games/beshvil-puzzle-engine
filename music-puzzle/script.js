(() => {
  "use strict";

  const config = window.SONG_CONFIG;
  const score = document.getElementById("score");
  const piano = document.getElementById("piano");

  if (!config) {
    score.innerHTML = '<p class="notation-error">קובץ השיר לא נטען.</p>';
    return;
  }

  document.getElementById("gameTitle").textContent = config.title;
  document.getElementById("gameSubtitle").textContent = config.subtitle;

  const SOLFEGE = {
    C:"דו", D:"רה", E:"מי", F:"פה",
    G:"סול", A:"לה", B:"סי"
  };

  const WHITE_NOTES = ["C4","D4","E4","F4","G4","A4","B4"];
  const BLACK_NOTES = [
    {note:"Cs4",after:1},
    {note:"Ds4",after:2},
    {note:"Fs4",after:4},
    {note:"Gs4",after:5},
    {note:"As4",after:6}
  ];

  const audioCache = new Map();

  function parseNote(note) {
    const normalized = note.replace("s","#");
    const match = /^([A-G])(#?)(\d+)$/.exec(normalized);
    if (!match) throw new Error(`Invalid note: ${note}`);
    return {
      letter:match[1],
      accidental:match[2],
      octave:Number(match[3])
    };
  }

  function colorFor(note) {
    return config.noteColors[parseNote(note).letter];
  }

  function renderNotation() {
    if (!window.ABCJS || typeof window.ABCJS.renderAbc !== "function") {
      score.innerHTML =
        '<p class="notation-error">מנוע התווים לא נטען. ודאו שהקובץ abcjs-basic-min.js הועלה.</p>';
      return;
    }

    score.innerHTML = "";

    window.ABCJS.renderAbc(score, config.abc, {
      responsive:"resize",
      staffwidth:930,
      scale:1.25,
      paddingtop:6,
      paddingbottom:42,
      paddingleft:10,
      paddingright:10,
      add_classes:true,
      stretchlast:true,
      selectionColor:"transparent"
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(addColorDots);
    });
  }

  function addColorDots() {
    const svg = score.querySelector("svg");
    if (!svg) return;

    svg.querySelectorAll(".note-color-dots-layer").forEach(el => el.remove());

    const allNoteGroups = [...svg.querySelectorAll(".abcjs-note")];
    const noteGroups = allNoteGroups
      .filter(group => {
        try {
          const box = group.getBBox();
          return box.width > 0 && box.height > 0;
        } catch {
          return false;
        }
      })
      .slice(0, config.notes.length);

    const ns = "http://www.w3.org/2000/svg";
    const layer = document.createElementNS(ns,"g");
    layer.setAttribute("class","note-color-dots-layer");

    noteGroups.forEach((group,index) => {
      const box = group.getBBox();
      const circle = document.createElementNS(ns,"circle");

      circle.setAttribute("cx", box.x + box.width / 2);
      circle.setAttribute("cy", 145);
      circle.setAttribute("r", 8.5);
      circle.setAttribute("fill", colorFor(config.notes[index]));
      circle.setAttribute("class","note-color-dot");

      layer.appendChild(circle);
    });

    svg.appendChild(layer);

    const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
    if (viewBox && viewBox.length === 4 && viewBox[3] < 172) {
      viewBox[3] = 172;
      svg.setAttribute("viewBox", viewBox.join(" "));
      svg.style.aspectRatio = `${viewBox[2]} / ${viewBox[3]}`;
      svg.style.height = "auto";
      const renderedHeight = score.clientWidth * viewBox[3] / viewBox[2];
      score.style.height = `${renderedHeight}px`;
    }
  }

  function createKey(note,type,left) {
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
    };

    const release = event => {
      event.preventDefault();
      key.classList.remove("is-active");
    };

    key.addEventListener("pointerdown",press);
    key.addEventListener("pointerup",release);
    key.addEventListener("pointercancel",release);
    key.addEventListener("pointerleave",release);

    return key;
  }

  function renderPiano() {
    piano.innerHTML = "";
    piano.style.setProperty("--white-count",7);

    WHITE_NOTES.forEach((note,index) => {
      piano.appendChild(
        createKey(note,"white",`calc(${index} * (100% / 7))`)
      );
    });

    BLACK_NOTES.forEach(item => {
      piano.appendChild(
        createKey(item.note,"black",`calc(${item.after} * (100% / 7))`)
      );
    });
  }

  function playSound(note) {
    let audio = audioCache.get(note);

    if (!audio) {
      audio = new Audio(`audio/${note}.wav`);
      audio.preload = "auto";
      audioCache.set(note,audio);
    }

    audio.pause();
    audio.currentTime = 0;
    audio.volume = .88;
    audio.play().catch(() => {});
  }

  renderPiano();
  renderNotation();

  [...WHITE_NOTES,...BLACK_NOTES.map(item => item.note)].forEach(note => {
    const audio = new Audio(`audio/${note}.wav`);
    audio.preload = "auto";
    audioCache.set(note,audio);
  });

  let resizeTimer;
  window.addEventListener("resize",() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(addColorDots,180);
  });
})();
