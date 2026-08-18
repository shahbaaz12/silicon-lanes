const themeStorageKey = "silicon-lanes-theme";
const savedTheme = localStorage.getItem(themeStorageKey);
const initialTheme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";

document.documentElement.dataset.theme = initialTheme;

function mountThemeToggle() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";

  const render = () => {
    const light = document.documentElement.dataset.theme === "light";
    button.innerHTML = `<span aria-hidden="true">${light ? "\u263e" : "\u2600"}</span><span>${light ? "Dark" : "Light"}</span>`;
    button.setAttribute("aria-label", `Switch to ${light ? "dark" : "light"} theme`);
    button.title = `Switch to ${light ? "dark" : "light"} theme`;
  };

  button.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(themeStorageKey, nextTheme);
    render();
  });

  render();
  document.body.append(button);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountThemeToggle);
else mountThemeToggle();
