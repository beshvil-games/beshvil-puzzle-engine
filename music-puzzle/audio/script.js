(() => {
  "use strict";

  const config = window.SONG_CONFIG;
  if (!config) throw new Error("SONG_CONFIG is missing");

  const VF = window.Vex?.Flow || window.VexFlow;
  if (!VF) throw new Error("VexFlow failed to load");

  const score = document.getElementById("score");
  const piano = document.getElementById("piano");
  const statusText = document.getElementById("statusText");

  document.getElementById("gameTitle").textContent = config.title;
  document.getElementById("gameSubtitle").textContent = config.subtitle;

  const SOLFEGE = { C:"דו", D:"רה", E:"מי", F:"פה", G:"סול", A:"לה", B:"סי" };
  const WHITE_NOTES = ["C4","D4","E4","F4","G4","A4","B4"];
  const BLACK_NOTES = [
    { note:"Cs4", after:1 }, { note:"Ds4", after:2 },
    { note:"Fs4", after:4 }, { note:"Gs4", after:5 }, { note:"As4", after:6 }
  ];

  const audioCache = new Map();
  const renderedNotes = [];
  const renderedDots = [];
  let progressIndex = 0;

  function parseNote(note) {
    const normalized = note.replace("s","#");
    const match = /^([A-G])(#?)(\d+)$/.exec(normalized);
    if (!match) throw new Error(`Invalid note: ${note}`);
    return { letter:match[1], accidental:match[2], octave:Number(match[3]) };
  }

  function colorFor(note) {
    return config.noteColors[parseNote(note).letter];
  }

  function vexKey(note) {
    const n = parseNote(note);
    return `${n.letter.toLowerCase()}${n.accidental}/${n.octave}`;
  }

  function durationCode(duration) {
    if (duration >= 2) return "h";
    if (duration <= .5) return "8";
    return "q";
  }

  function splitMeasures() {
    const beatsPerMeasure = config.timeSignature?.[0] || 4;
    const measures = [];
    let current = [];
    let beats = 0;

    config.melody.forEach(item => {
      current.push(item);
      beats += item.duration || 1;

      if (item.measureEnd || beats >= beatsPerMeasure) {
        measures.push(current);
        current = [];
        beats = 0;
      }
    });

    if (current.length) measures.push(current);
    return measures;
  }

  function renderScore() {
    score.textContent = "";
    renderedNotes.length = 0;
    renderedDots.length = 0;

    const measures = splitMeasures();
    const measureWidth = 150;
    const leftPadding = 15;
    const firstExtra = 70;
    const width = leftPadding + firstExtra + measures.length * measureWidth + 20;
    const height = 205;

    score.style.width = `${width}px`;

    const renderer = new VF.Renderer(score, VF.Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    let x = leftPadding;

    measures.forEach((measure, measureIndex) => {
      const staveWidth = measureWidth + (measureIndex === 0 ? firstExtra : 0);
      const stave = new VF.Stave(x, 28, staveWidth);

      if (measureIndex === 0) {
        stave.addClef("treble");
        const [top,bottom] = config.timeSignature || [4,4];
        stave.addTimeSignature(`${top}/${bottom}`);
      }

      stave.setContext(context).draw();

      const notes = measure.map(item => {
        const note = new VF.StaveNote({
          clef:"treble",
          keys:[vexKey(item.note)],
          duration:durationCode(item.duration || 1)
        });

        if (parseNote(item.note).accidental) {
          note.addModifier(new VF.Accidental("#"),0);
        }

        renderedNotes.push(note);
        return note;
      });

      const beats = config.timeSignature?.[0] || 4;
      const beatValue = config.timeSignature?.[1] || 4;
      const voice = new VF.Voice({
        num_beats:beats,
        beat_value:beatValue
      }).setStrict(false);

      voice.addTickables(notes);

      new VF.Formatter()
        .joinVoices([voice])
        .format([voice], staveWidth - (measureIndex === 0 ? 92 : 28));

      voice.draw(context, stave);

      x += staveWidth;
    });

    requestAnimationFrame(createDotsAndClasses);
  }

  function createDotsAndClasses() {
    const svg = score.querySelector("svg");
    if (!svg) return;

    const ns = "http://www.w3.org/2000/svg";
    const overlay = document.createElementNS(ns,"g");
    overlay.setAttribute("class","note-dots-layer");
    svg.appendChild(overlay);

    renderedNotes.forEach((note,index) => {
      const noteElement = note.getSVGElement?.();
      if (noteElement) {
        noteElement.classList.add("vf-note");
        noteElement.dataset.index = index;
      }

      const dot = document.createElementNS(ns,"circle");
      dot.setAttribute("cx", note.getAbsoluteX());
      dot.setAttribute("cy", 174);
      dot.setAttribute("r", 8.5);
      dot.setAttribute("fill", colorFor(config.melody[index].note));
      dot.setAttribute("stroke","#fff");
      dot.setAttribute("stroke-width","2.5");
      dot.setAttribute("class","note-color-dot");
      dot.style.color = colorFor(config.melody[index].note);
      dot.dataset.index = index;
      overlay.appendChild(dot);
      renderedDots.push(dot);
    });

    updateCurrentNote();
  }

  function createKey(note,type,left) {
    const key = document.createElement("button");
    key.type = "button";
    key.className = `key ${type}`;
    key.dataset.note = note;
    key.style.left = left;
    key.setAttribute("aria-label",note);

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

    key.addEventListener("pointerdown",press);
    key.addEventListener("pointerup",release);
    key.addEventListener("pointercancel",release);
    key.addEventListener("pointerleave",release);

    return key;
  }

  function renderPiano() {
    piano.textContent = "";
    piano.style.setProperty("--white-count",7);

    WHITE_NOTES.forEach((note,index) => {
      piano.appendChild(createKey(note,"white",`calc(${index} * (100% / 7))`));
    });

    BLACK_NOTES.forEach(item => {
      piano.appendChild(createKey(item.note,"black",`calc(${item.after} * (100% / 7))`));
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

  function noteElementAt(index) {
    return renderedNotes[index]?.getSVGElement?.() || null;
  }

  function handleGameNote(note) {
    const expected = config.melody[progressIndex]?.note;
    if (!expected) return;

    const normalizedNote = note.replace("s","#");

    if (normalizedNote === expected) {
      const noteElement = noteElementAt(progressIndex);
      const dot = renderedDots[progressIndex];

      dot?.classList.remove("is-current");
      noteElement?.classList.add("is-playing");
      dot?.classList.add("is-playing");

      setTimeout(() => {
        noteElement?.classList.remove("is-playing");
        noteElement?.classList.add("is-done");
        dot?.classList.remove("is-playing");
        dot?.classList.add("is-done");
      },300);

      progressIndex++;

      if (progressIndex >= config.melody.length) {
        statusText.textContent = "כל הכבוד! ניגנתם את המנגינה";
        setTimeout(resetGame,1800);
      } else {
        updateCurrentNote();
      }
    } else {
      statusText.textContent = "נסו שוב לפי העיגול הבא";
      setTimeout(() => {
        if (progressIndex < config.melody.length) {
          statusText.textContent = "לחצו על הקלידים לפי סדר התווים";
        }
      },900);
    }
  }

  function updateCurrentNote() {
    renderedDots.forEach((dot,index) => {
      dot.classList.toggle("is-current",index === progressIndex);
    });

    renderedDots[progressIndex]?.scrollIntoView({
      behavior:"smooth",
      block:"nearest",
      inline:"center"
    });
  }

  function resetGame() {
    progressIndex = 0;

    renderedDots.forEach(dot => {
      dot.classList.remove("is-playing","is-done","is-current");
    });

    renderedNotes.forEach(note => {
      note.getSVGElement?.()?.classList.remove("is-playing","is-done");
    });

    statusText.textContent = "לחצו על הקלידים לפי סדר התווים";
    updateCurrentNote();
  }

  renderPiano();
  renderScore();

  [...WHITE_NOTES,...BLACK_NOTES.map(item => item.note)].forEach(note => {
    const audio = new Audio(`audio/${note}.wav`);
    audio.preload = "auto";
    audioCache.set(note,audio);
  });

  window.addEventListener("resize",() => {
    clearTimeout(window.__scoreResizeTimer);
    window.__scoreResizeTimer = setTimeout(renderScore,150);
  });
})();
