const menuButton = document.querySelector(".menu");
const navigation = document.querySelector(".topbar nav");
menuButton?.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!open));
  navigation?.classList.toggle("open", !open);
});
navigation?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => navigation.classList.remove("open")));

document.querySelector("[data-quick-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const contact = String(data.get("contact") || "").trim();
  const subject = encodeURIComponent("Обсудить проект");
  const body = encodeURIComponent(`Здравствуйте! Мой контакт: ${contact}`);
  window.location.href = `mailto:hello@webstudiolab.ru?subject=${subject}&body=${body}`;
});
document.querySelectorAll("[data-year]").forEach((node) => { node.textContent = new Date().getFullYear(); });
