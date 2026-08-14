// ============================================================
// No desktop, botão direito decrementa contadores. No celular
// não existe "botão direito", então esse helper adiciona toque
// e segure (~500ms) como alternativa — funciona nos dois.
// ============================================================
export function bindCountTap(el, onIncrement, onDecrement){
  let pressTimer = null;
  let longPressed = false;

  el.addEventListener("touchstart", () => {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      if(navigator.vibrate) navigator.vibrate(12);
      onDecrement();
    }, 500);
  }, { passive: true });

  const cancelPress = () => clearTimeout(pressTimer);
  el.addEventListener("touchend", cancelPress);
  el.addEventListener("touchmove", cancelPress);
  el.addEventListener("touchcancel", cancelPress);

  el.addEventListener("click", (e) => {
    if(longPressed){ longPressed = false; e.preventDefault(); return; }
    onIncrement();
  });

  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    onDecrement();
  });
}
