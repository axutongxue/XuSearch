let _darkModeMediaListener = null;


export function applyDarkModeToDoc(mode) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (_darkModeMediaListener) {
    mq.removeEventListener("change", _darkModeMediaListener);
    _darkModeMediaListener = null;
  }
  if (mode === "dark") {
    document.documentElement.dataset.theme = "dark";
  } else if (mode === "light") {
    document.documentElement.dataset.theme = "";
  } else {
    document.documentElement.dataset.theme = mq.matches ? "dark" : "";
    _darkModeMediaListener = (e) => {
      document.documentElement.dataset.theme = e.matches ? "dark" : "";
    };
    mq.addEventListener("change", _darkModeMediaListener);
  }
}
