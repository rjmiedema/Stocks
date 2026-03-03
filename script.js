const button = document.getElementById("ping-btn");
const output = document.getElementById("output");

button.addEventListener("click", () => {
  const now = new Date().toLocaleTimeString();
  output.textContent = `JavaScript is working (${now}).`;
});