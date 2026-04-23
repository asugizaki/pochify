async function injectPartial(targetId, url) {
  const el = document.getElementById(targetId);
  if (!el) return;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    el.innerHTML = await res.text();
  } catch (error) {
    console.error(error);
  }
}

function toggleMenu() {
  const nav = document.getElementById("siteNav");
  if (nav) nav.classList.toggle("open");
}

async function initLayout() {
  await injectPartial("site-header", "/partials/header.html");
  await injectPartial("site-footer", "/partials/footer.html");
}

initLayout();
window.toggleMenu = toggleMenu;