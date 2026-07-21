/*
      כדי לשנות את כמות התמונות:
      מוסיפים או מוחקים שורות ברשימה הזאת.

      image = שם קובץ התמונה
      letter = האות שתופיע מאחור
    */
    const answerOnCards = "לוחהכדורסל";

    const images = [
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.jpg",
      "5.jpg",
      "6.jpg",
      "7.jpg",
      "8.jpg",
      "9.jpg",
      "10.jpg"
    ];

    const items = images.map((image, index) => ({
      image,
      letter: answerOnCards[index] || ""
    }));

    const container = document.getElementById("container");
    const message = document.getElementById("message");
    const checkButton = document.getElementById("checkButton");
    const shuffleButton = document.getElementById("shuffleButton");
    const soundButton = document.getElementById("soundButton");
    const successPanel = document.getElementById("successPanel");

    let draggedCard = null;
    let pointerCard = null;
    let pointerClone = null;
    let holdTimer = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchPointerId = null;
    let touchDragActive = false;
    const HOLD_DELAY = 350;
    const MOVE_TOLERANCE = 12;
    let soundOn = true;
    let audioContext = null;

    function desktopColumns(count) {
      if (count <= 4) return count;
      if (count <= 8) return 4;
      if (count <= 10) return 5;
      if (count <= 12) return 6;
      return 5;
    }

    container.style.setProperty("--columns", desktopColumns(items.length));

    function getAudioContext() {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      return audioContext;
    }

    function tone(frequency, duration, type = "sine", volume = 0.05, delay = 0) {
      if (!soundOn) return;

      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    }

    function playSwap() {
      tone(330, .08, "triangle", .035);
      tone(440, .09, "triangle", .03, .05);
    }

    function playWrong() {
      tone(180, .14, "sawtooth", .035);
      tone(140, .18, "sawtooth", .03, .10);
    }

    function playSuccess() {
      tone(523.25, .18, "sine", .045);
      tone(659.25, .18, "sine", .045, .13);
      tone(783.99, .28, "sine", .05, .26);
    }

    function playFlip(index) {
      tone(280 + index * 22, .08, "triangle", .025);
    }

    function shuffle(array) {
      const copy = [...array];

      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }

      const alreadyCorrect = copy.every(
        (item, index) => item.image === items[index].image
      );

      return alreadyCorrect && copy.length > 1 ? shuffle(array) : copy;
    }

    function createCard(item) {
      const card = document.createElement("div");
      card.className = "card";
      card.draggable = true;
      card.dataset.image = item.image;

      card.innerHTML = `
        <div class="card-inner">
          <div class="card-front">
            <img src="${item.image}" alt="">
          </div>
          <div class="card-back">${item.letter}</div>
        </div>
      `;

      return card;
    }

    function render(list) {
      container.innerHTML = "";
      successPanel.classList.remove("show");

      list.forEach((item, index) => {
        const slot = document.createElement("div");
        slot.className = "slot";

        const number = document.createElement("div");
        number.className = "position-number";
        number.textContent = index + 1;

        slot.appendChild(number);
        slot.appendChild(createCard(item));
        container.appendChild(slot);
      });

      addDragListeners();
    }

    function cards() {
      return [...container.querySelectorAll(".card")];
    }

    function clearFeedback() {
      cards().forEach(card => {
        card.classList.remove("correct", "wrong", "shake", "success-pop");
      });
    }

    function addDragListeners() {
      cards().forEach(card => {
        card.addEventListener("dragstart", () => {
          if (card.classList.contains("flipped")) return;
          draggedCard = card;
          clearFeedback();
          card.classList.add("dragging");
        });

        card.addEventListener("dragend", () => {
          card.classList.remove("dragging");
          cards().forEach(c => c.classList.remove("drop-target"));
          draggedCard = null;
        });

        card.addEventListener("dragover", event => {
          event.preventDefault();

          if (draggedCard && draggedCard !== card) {
            card.classList.add("drop-target");
          }
        });

        card.addEventListener("dragleave", () => {
          card.classList.remove("drop-target");
        });

        card.addEventListener("drop", event => {
          event.preventDefault();
          card.classList.remove("drop-target");

          if (!draggedCard || draggedCard === card) return;
          swapCards(draggedCard, card);
        });

        card.addEventListener("pointerdown", pointerDown);
      });
    }

    function swapCards(first, second) {
      const firstSlot = first.closest(".slot");
      const secondSlot = second.closest(".slot");

      firstSlot.appendChild(second);
      secondSlot.appendChild(first);

      message.textContent = "";
      clearFeedback();
      playSwap();
    }

    function pointerDown(event) {
      if (event.pointerType === "mouse") return;
      if (event.currentTarget.classList.contains("flipped")) return;

      cancelTouchDrag();

      pointerCard = event.currentTarget;
      touchPointerId = event.pointerId;
      touchStartX = event.clientX;
      touchStartY = event.clientY;
      touchDragActive = false;

      holdTimer = setTimeout(() => {
        if (!pointerCard) return;

        touchDragActive = true;
        clearFeedback();
        successPanel.classList.remove("show");

        pointerCard.classList.add("dragging", "hold-ready");

        try {
          pointerCard.setPointerCapture(touchPointerId);
        } catch (error) {
          // Some mobile browsers do not allow capture in every situation.
        }

        pointerClone = pointerCard.cloneNode(true);
        pointerClone.classList.remove("dragging", "hold-ready");
        pointerClone.style.position = "fixed";
        pointerClone.style.width = pointerCard.offsetWidth + "px";
        pointerClone.style.height = pointerCard.offsetHeight + "px";
        pointerClone.style.zIndex = "9999";
        pointerClone.style.pointerEvents = "none";
        pointerClone.style.opacity = "0.88";
        pointerClone.style.transform = "scale(1.03)";
        document.body.appendChild(pointerClone);

        moveClone(event);
        tone(520, .07, "triangle", .025);
      }, HOLD_DELAY);

      pointerCard.addEventListener("pointermove", pointerMove);
      pointerCard.addEventListener("pointerup", pointerUp, { once: true });
      pointerCard.addEventListener("pointercancel", pointerCancel, { once: true });
      pointerCard.addEventListener("lostpointercapture", pointerCancel, { once: true });
    }

    function pointerMove(event) {
      if (!pointerCard || event.pointerId !== touchPointerId) return;

      const movedX = Math.abs(event.clientX - touchStartX);
      const movedY = Math.abs(event.clientY - touchStartY);

      // Before the long press activates, any normal scrolling movement
      // cancels the drag and leaves the page free to scroll.
      if (!touchDragActive) {
        if (movedX > MOVE_TOLERANCE || movedY > MOVE_TOLERANCE) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        return;
      }

      event.preventDefault();
      moveClone(event);

      cards().forEach(c => c.classList.remove("drop-target"));

      const element = document.elementFromPoint(event.clientX, event.clientY);
      const target = element ? element.closest(".card") : null;

      if (target && target !== pointerCard) {
        target.classList.add("drop-target");
      }
    }

    function moveClone(event) {
      if (!pointerClone) return;

      pointerClone.style.left =
        (event.clientX - pointerClone.offsetWidth / 2) + "px";

      pointerClone.style.top =
        (event.clientY - pointerClone.offsetHeight / 2) + "px";
    }

    function pointerUp(event) {
      clearTimeout(holdTimer);
      holdTimer = null;

      if (touchDragActive) {
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const target = element ? element.closest(".card") : null;

        if (target && pointerCard && target !== pointerCard) {
          swapCards(pointerCard, target);
        }
      }

      cancelTouchDrag();
    }

    function pointerCancel() {
      cancelTouchDrag();
    }

    function cancelTouchDrag() {
      clearTimeout(holdTimer);
      holdTimer = null;

      if (pointerCard) {
        pointerCard.classList.remove("dragging", "hold-ready");
        pointerCard.removeEventListener("pointermove", pointerMove);
      }

      cards().forEach(c => c.classList.remove("drop-target"));

      if (pointerClone) {
        pointerClone.remove();
      }

      pointerCard = null;
      pointerClone = null;
      touchPointerId = null;
      touchDragActive = false;
    }

    window.addEventListener("blur", cancelTouchDrag);
    window.addEventListener("orientationchange", cancelTouchDrag);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelTouchDrag();
    });

    checkButton.addEventListener("click", () => {
      clearFeedback();

      const currentCards = cards();
      const correctOrder = items.map(item => item.image);

      const results = currentCards.map(
        (card, index) => card.dataset.image === correctOrder[index]
      );

      const isCorrect = results.every(Boolean);

      if (isCorrect) {
        message.textContent = "";
        playSuccess();

        currentCards.forEach((card, index) => {
          card.classList.add("correct");

          setTimeout(() => {
            card.classList.add("success-pop", "flipped");
            playFlip(index);
          }, index * 140);
        });

        setTimeout(() => {
          successPanel.classList.add("show");
          successPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, currentCards.length * 140 + 250);
      } else {
        successPanel.classList.remove("show");
        const correctCount = results.filter(Boolean).length;
        message.textContent =
          correctCount === 0
            ? "עדיין לא. נסו שוב."
            : `${correctCount} תמונות נמצאות במקום הנכון. נסו שוב.`;

        playWrong();

        currentCards.forEach((card, index) => {
          if (results[index]) {
            card.classList.add("correct");
          } else {
            card.classList.add("wrong", "shake");
          }
        });
      }
    });

    shuffleButton.addEventListener("click", () => {
      message.textContent = "";
      successPanel.classList.remove("show");
      render(shuffle(items));
      playSwap();
    });

    soundButton.addEventListener("click", () => {
      soundOn = !soundOn;
      soundButton.setAttribute("aria-pressed", String(soundOn));
      soundButton.textContent = soundOn
        ? "🔊 צלילים פעילים"
        : "🔇 צלילים כבויים";

      if (soundOn) playSwap();
    });

    render(shuffle(items));