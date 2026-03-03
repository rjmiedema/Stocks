const ALPHA_VANTAGE_API_KEY = "ZATJXMHZDJTBT8B4";
const BASE_URL = "https://www.alphavantage.co/query";

const symbolInput = document.getElementById("symbol-input");
const loadButton = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function normalizeTransactionType(rawType = "") {
  const type = rawType.toLowerCase();
  if (type.includes("buy")) return "BUY";
  if (type.includes("sell")) return "SELL";
  return rawType || "-";
}

function renderTable(rows) {
  if (!rows.length) {
    resultsEl.innerHTML = "<p>No insider transactions found for this ticker.</p>";
    return;
  }

  const bodyRows = rows
    .map((row) => {
      const txType = normalizeTransactionType(row.transaction_type);
      const txClass = txType === "BUY" ? "type-buy" : txType === "SELL" ? "type-sell" : "";
      return `
        <tr>
          <td>${row.transaction_date || "-"}</td>
          <td>${row.executive || "-"}</td>
          <td>${row.executive_title || "-"}</td>
          <td class="${txClass}">${txType}</td>
          <td>${row.shares || "-"}</td>
          <td>${row.share_price || "-"}</td>
        </tr>
      `;
    })
    .join("");

  resultsEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Insider</th>
          <th>Title</th>
          <th>Type</th>
          <th>Shares</th>
          <th>Price</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}

async function loadInsiderTransactions() {
  const symbol = symbolInput.value.trim().toUpperCase();

  if (!symbol) {
    setStatus("Enter a ticker symbol.", true);
    return;
  }

  if (ALPHA_VANTAGE_API_KEY === "YOUR_API_KEY_HERE") {
    setStatus("Set your Alpha Vantage API key in script.js first.", true);
    return;
  }

  setStatus(`Loading insider transactions for ${symbol}...`);
  resultsEl.innerHTML = "";

  try {
    const url = `${BASE_URL}?function=INSIDER_TRANSACTIONS&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(ALPHA_VANTAGE_API_KEY)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.Note) {
      throw new Error("API limit reached. Please wait and try again.");
    }

    if (data["Error Message"]) {
      throw new Error(data["Error Message"]);
    }

    const rows = Array.isArray(data.data) ? data.data : [];
    renderTable(rows.slice(0, 50));
    setStatus(`Loaded ${Math.min(rows.length, 50)} transactions for ${symbol}.`);
  } catch (error) {
    setStatus(`Failed to load data: ${error.message}`, true);
  }
}

loadButton.addEventListener("click", loadInsiderTransactions);
symbolInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadInsiderTransactions();
  }
});
