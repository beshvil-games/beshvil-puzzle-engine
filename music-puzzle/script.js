(() => {
  "use strict";

  const config = window.SONG_CONFIG;
  if (!config) throw new Error("SONG_CONFIG is missing");

  const NS = "http://www.w3.org/2000/svg";
  const scoreSvg = document.getElementById("scoreSvg");
  const piano = document.getElementById("piano");
  const statusText = document.getElementById("statusText");

  document.getElementById("gameTitle").textContent = config.title;
  document.getElementById("gameSubtitle").textContent = config.subtitle;

  const SOLFEGE = { C:"דו", D:"רה", E:"מי", F:"פה", G:"סול", A:"לה", B:"סי" };
  const WHITE_NOTES = ["C4","D4","E4","F4","G4","A4","B4"];
  const BLACK_NOTES = [
    { note:"Cs4", after:1 },
    { note:"Ds4", after:2 },
    { note:"Fs4", after:4 },
    { note:"Gs4", after:5 },
    { note:"As4", after:6 }
  ];
  const DIATONIC_INDEX = { C:0, D:1, E:2, F:3, G:4, A:5, B:6 };
  const audioCache = new Map();
  const scoreGroups = [];
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

  function svgEl(name, attrs={}) {
    const el = document.createElementNS(NS,name);
    Object.entries(attrs).forEach(([key,value]) => el.setAttribute(key,value));
    return el;
  }

  function staffStep(note) {
    const n = parseNote(note);
    return (n.octave - 4) * 7 + DIATONIC_INDEX[n.letter];
  }

  function staffY(note) {
    return 126 - staffStep(note) * 7;
  }

  function drawLedgerLines(group,x,y) {
    if (y > 126) {
      for (let lineY=140; lineY<=y+1; lineY+=14) {
        group.appendChild(svgEl("line",{
          x1:x-15,y1:lineY,x2:x+15,y2:lineY,class:"staff-line"
        }));
      }
    }

    if (y < 70) {
      for (let lineY=56; lineY>=y-1; lineY-=14) {
        group.appendChild(svgEl("line",{
          x1:x-15,y1:lineY,x2:x+15,y2:lineY,class:"staff-line"
        }));
      }
    }
  }

  function drawNote(group,x,y,duration) {
    drawLedgerLines(group,x,y);

    const stemUp = y >= 98;
    const stemX = stemUp ? x+8 : x-8;
    const stemEndY = stemUp ? y-43 : y+43;

    group.appendChild(svgEl("ellipse",{
      cx:x,cy:y,rx:10.2,ry:7,
      transform:`rotate(-20 ${x} ${y})`,
      class:"note-head"
    }));

    group.appendChild(svgEl("line",{
      x1:stemX,y1:y,x2:stemX,y2:stemEndY,
      "stroke-width":3.6,class:"note-stem"
    }));

    if (duration <= 0.5) {
      const path = stemUp
        ? `M ${stemX} ${stemEndY} C ${stemX+18} ${stemEndY+7}, ${stemX+18} ${stemEndY+22}, ${stemX+4} ${stemEndY+29}`
        : `M ${stemX} ${stemEndY} C ${stemX-18} ${stemEndY-7}, ${stemX-18} ${stemEndY-22}, ${stemX-4} ${stemEndY-29}`;

      group.appendChild(svgEl("path",{
        d:path,"stroke-width":4.2,class:"note-flag"
      }));
    }
  }

  function renderScore() {
    scoreSvg.textContent = "";
    scoreGroups.length = 0;

    const width = Math.max(760,150 + config.melody.length * 63);
    const height = 205;

    scoreSvg.setAttribute("viewBox",`0 0 ${width} ${height}`);

    for (let i=0;i<5;i++) {
      scoreSvg.appendChild(svgEl("line",{
        x1:24,y1:70+i*14,x2:width-24,y2:70+i*14,class:"staff-line"
      }));
    }

    const [top,bottom] = config.timeSignature || [4,4];
    const topText = svgEl("text",{x:62,y:94,class:"time-signature"});
    const bottomText = svgEl("text",{x:62,y:128,class:"time-signature"});
    topText.textContent = top;
    bottomText.textContent = bottom;
    scoreSvg.append(topText,bottomText);

    let x = 115;

    config.melody.forEach((item,index) => {
      const group = svgEl("g",{
        class:"note-group",
        "data-index":index,
        "data-note":item.note
      });

      const y = staffY(item.note);
      drawNote(group,x,y,item.duration || 1);

      group.appendChild(svgEl("circle",{
        cx:x,cy:171,r:8.5,
        fill:colorFor(item.note),
        class:"note-dot",
        style:`color:${colorFor(item.note)}`
      }));

      scoreSvg.appendChild(group);
      scoreGroups.push(group);

      if (item.measureEnd) {
        scoreSvg.appendChild(svgEl("line",{
          x1:x+31,y1:67,x2:x+31,y2:129,class:"bar-line"
        }));
      }

      x += 63;
    });

    scoreSvg.appendChild(svgEl("line",{
      x1:width-31,y1:67,x2:width-31,y2:129,class:"bar-line"
    }));

    scoreSvg.appendChild(svgEl("line",{
      x1:width-24,y1:67,x2:width-24,y2:129,
      class:"bar-line","stroke-width":4
    }));

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
    audio.volume = 0.88;
    audio.play().catch(() => {});
  }

  function handleGameNote(note) {
    const expected = config.melody[progressIndex]?.note;
    if (!expected) return;

    const normalizedNote = note.replace("s","#");

    if (normalizedNote === expected) {
      const group = scoreGroups[progressIndex];
      group.classList.remove("is-current");
      group.classList.add("is-playing");

      setTimeout(() => {
        group.classList.remove("is-playing");
        group.classList.add("is-done");
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
    scoreGroups.forEach((group,index) => {
      group.classList.toggle("is-current",index === progressIndex);
    });

    scoreGroups[progressIndex]?.scrollIntoView({
      behavior:"smooth",
      block:"nearest",
      inline:"center"
    });
  }

  function resetGame() {
    progressIndex = 0;

    scoreGroups.forEach(group => {
      group.classList.remove("is-playing","is-done","is-current");
    });

    statusText.textContent = "לחצו על הקלידים לפי סדר התווים";
    updateCurrentNote();
  }

  renderScore();
  renderPiano();

  [...WHITE_NOTES,...BLACK_NOTES.map(item => item.note)].forEach(note => {
    const audio = new Audio(`audio/${note}.wav`);
    audio.preload = "auto";
    audioCache.set(note,audio);
  });
})();
