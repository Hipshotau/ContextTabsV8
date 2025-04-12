/**
 * Super‑light tooltip helper – any element with `[data-tip]` gets a hover hint.
 */

const tip = document.createElement("div");
tip.style.cssText = `
  position:fixed;pointer-events:none;z-index:2147483646;
  background:#333;color:#fff;padding:6px 10px;border-radius:4px;
  font-size:12px;font-family:Arial;opacity:0;transition:opacity .15s`;
document.addEventListener("DOMContentLoaded", () => document.body.appendChild(tip));

let active = false;

function show(e: MouseEvent) {
  const el = e.target as HTMLElement;
  const msg = el?.getAttribute("data-tip");
  if (!msg) return;
  tip.textContent = msg;
  const rect = el.getBoundingClientRect();
  tip.style.top = `${rect.bottom + 8 + window.scrollY}px`;
  tip.style.left = `${rect.left + rect.width / 2 - tip.offsetWidth / 2 + window.scrollX}px`;
  tip.style.opacity = "1";
  active = true;
}

function hide() {
  if (!active) return;
  tip.style.opacity = "0";
  active = false;
}

document.addEventListener("mouseover", show);
document.addEventListener("mouseout", hide); 