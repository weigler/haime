const toastEl = document.getElementById("toast");
let hideTimer = null;

export function showToast(message, duration = 3200){
  toastEl.textContent = message;
  toastEl.classList.remove("is-hidden");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toastEl.classList.add("is-hidden"), duration);
}
