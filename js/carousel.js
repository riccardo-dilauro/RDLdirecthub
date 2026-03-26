function initHeroCarousel(options) {
  const { track, slides, dotsContainer, prevButton, nextButton } = options;
  if (!track || slides.length === 0) {
    return;
  }

  let index = 0;
  let timer = null;

  function renderDots() {
    dotsContainer.innerHTML = "";
    slides.forEach((_, dotIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `dot ${dotIndex === index ? "active" : ""}`.trim();
      button.setAttribute("aria-label", `Vai alla slide ${dotIndex + 1}`);
      button.addEventListener("click", () => {
        goTo(dotIndex);
      });
      dotsContainer.appendChild(button);
    });
  }

  function update() {
    track.style.transform = `translateX(-${index * 100}%)`;
    [...dotsContainer.children].forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === index);
    });
  }

  function goTo(newIndex) {
    index = (newIndex + slides.length) % slides.length;
    update();
  }

  function next() {
    goTo(index + 1);
  }

  function prev() {
    goTo(index - 1);
  }

  function startAutoplay() {
    stopAutoplay();
    timer = window.setInterval(next, 5000);
  }

  function stopAutoplay() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  prevButton.addEventListener("click", prev);
  nextButton.addEventListener("click", next);

  const wrapper = track.closest(".hero-carousel");
  wrapper.addEventListener("mouseenter", stopAutoplay);
  wrapper.addEventListener("mouseleave", startAutoplay);
  wrapper.addEventListener("focusin", stopAutoplay);
  wrapper.addEventListener("focusout", startAutoplay);

  wrapper.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      prev();
    }
    if (event.key === "ArrowRight") {
      next();
    }
  });

  renderDots();
  update();
  startAutoplay();
}
