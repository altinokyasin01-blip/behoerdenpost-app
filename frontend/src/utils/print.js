// window.print() blocks script execution until the native print dialog
// closes (long-standing behavior in Chrome/Firefox/Safari) — so swapping
// document.title before the call and restoring right after reliably shrinks
// the browser's own print header without leaving the tab title changed.
export function printWithTitle(title) {
  const original = document.title;
  if (title) document.title = title;
  window.print();
  document.title = original;
}
