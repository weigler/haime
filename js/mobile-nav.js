import { enterToday } from "./today.js";
import { showPanel, setActiveNav, teardownOthers } from "./panel-router.js";

const tabButtons = document.querySelectorAll(".mobile-tab");
const moreMenu = document.getElementById("more-menu");

function setActiveTab(name){
  tabButtons.forEach(b => b.classList.toggle("is-active", b.dataset.mobileTab === name));
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.mobileTab;
    setActiveTab(tab);

    if(tab === "today"){
      enterToday();
    } else if(tab === "habits"){
      teardownOthers("habit");
      showPanel("empty");
      setActiveNav(null);
      document.querySelector(".sidebar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if(tab === "tasks"){
      document.getElementById("btn-tasks").click();
    } else if(tab === "more"){
      moreMenu.classList.remove("is-hidden");
    }
  });
});

document.getElementById("more-menu-close").addEventListener("click", closeMoreMenu);
moreMenu.addEventListener("click", (e) => { if(e.target === moreMenu) closeMoreMenu(); });

document.getElementById("more-menu-overview").addEventListener("click", () => {
  closeMoreMenu();
  setActiveTab(null);
  document.getElementById("btn-overview").click();
});

document.getElementById("more-menu-settings").addEventListener("click", () => {
  closeMoreMenu();
  document.getElementById("btn-settings").click();
});

document.getElementById("more-menu-logout").addEventListener("click", () => {
  closeMoreMenu();
  document.getElementById("btn-user-menu").click();
});

function closeMoreMenu(){
  moreMenu.classList.add("is-hidden");
}
