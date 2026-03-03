const ALPHA_VANTAGE_API_KEY = "ZATJXMHZDJTBT8B4";
const BASE_URL = "https://www.alphavantage.co/query";
const TOP_50_SYMBOLS = [
  "NVDA", "AAPL", "GOOG", "MSFT", "AMZN", "META", "AVGO", "TSLA", "WMT", "MU",
  "COST", "NFLX", "PLTR", "AMD", "CSCO", "AMAT", "LRCX", "TMUS", "LIN", "PEP",
  "INTC", "AMGN", "KLAC", "TXN", "GILD", "ISRG", "ADI", "SHOP", "HON", "QCOM",
  "PDD", "APP", "ARM", "BKNG", "VRTX", "PANW", "CEG", "CME", "INTU", "SBUX",
  "CMCSA", "ADBE", "EQIX", "WDC", "SNDK", "CRWD", "STX", "MAR", "MELI", "ADP"
];

const symbolInput = document.getElementById("symbol-input");
const loadButton = document.getElementById("load-btn");
const minSharesInput = document.getElementById("min-shares-input");
const minValueInput = document.getElementById("min-value-input");
const popupAlertsCheckbox = document.getElementById("popup-alerts");
const top50DateInput = document.getElementById("top50-date-input");
const loadTop50Button = document.getElementById("load-top50-btn");
const top50StatusEl = document.getElementById("top50-status");
const top50ResultsEl = document.getElementById("top50-results");
const statusEl = document.getElementById("status");
const alertsEl = document.getElementById("alerts");
const dailySummaryEl = document.getElementById("daily-summary");
const resultsEl = document.getElementById("results");
const numberFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

let lastPopupSignature = "";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function setTop50Status(message, isError = false) {
  top50StatusEl.textContent = message;
  top50StatusEl.classList.toggle("error", isError);
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTransactionType(rawType = "") {
  const type = rawType.toLowerCase();
  if (type.includes("buy")) return "BUY";
  if (type.includes("sell")) return "SELL";
  return rawType || "-";
}

function classifyTransaction(rawType = "") {
  const type = rawType.toLowerCase();
  if (type.includes("buy") || type.includes("purchase") || type.includes("acquir")) return "BUY";
  if (type.includes("sell") || type.includes("dispos")) return "SELL";
  return "OTHER";
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  return Number(cleaned);
}

function formatInt(value) {
  if (!Number.isFinite(value)) return "-";
  return numberFormatter.format(Math.round(value));
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "-";
  return currencyFormatter.format(value);
}

function calculateTradeValue(row) {
  const shares = parseNumber(row.shares);
  const price = parseNumber(row.share_price);
  if (!Number.isFinite(shares) || !Number.isFinite(price)) return NaN;
  return shares * price;
}

function getThresholdValue(inputEl) {
  const parsed = Number(inputEl.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function renderAlerts(rows, symbol) {
  const minShares = getThresholdValue(minSharesInput);
  const minTradeValue = getThresholdValue(minValueInput);

  const highVolumeRows = rows.filter((row) => {
    const shares = parseNumber(row.shares);
    const tradeValue = calculateTradeValue(row);
    return shares >= minShares || tradeValue >= minTradeValue;
  });

  if (!highVolumeRows.length) {
    alertsEl.innerHTML = "<p class=\"alerts-empty\">No high-volume alerts for current thresholds.</p>";
    lastPopupSignature = "";
    return;
  }

  alertsEl.innerHTML = highVolumeRows
    .slice(0, 10)
    .map((row) => {
      const txType = normalizeTransactionType(row.transaction_type);
      const shares = parseNumber(row.shares);
      const tradeValue = calculateTradeValue(row);
      return `
        <article class="alert-card">
          <strong>${escapeHtml(symbol)} ${escapeHtml(txType)}</strong>
          by ${escapeHtml(row.executive || "Unknown insider")}
          on ${escapeHtml(row.transaction_date || "Unknown date")}
          <br>
          Shares: ${formatInt(shares)} | Value: ${formatCurrency(tradeValue)}
        </article>
      `;
    })
    .join("");

  if (popupAlertsCheckbox.checked) {
    const popupSignature = highVolumeRows
      .slice(0, 10)
      .map((row) => `${row.transaction_date}|${row.executive}|${row.shares}|${row.share_price}|${row.transaction_type}`)
      .join(";");

    if (popupSignature && popupSignature !== lastPopupSignature) {
      window.alert(`${highVolumeRows.length} high-volume insider transaction(s) detected for ${symbol}.`);
      lastPopupSignature = popupSignature;
    }
  }
}

function summarizeByDay(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const date = row.transaction_date || "Unknown";
    const txType = normalizeTransactionType(row.transaction_type);
    const shares = parseNumber(row.shares);
    const tradeValue = calculateTradeValue(row);

    if (!grouped.has(date)) {
      grouped.set(date, {
        date,
        buyCount: 0,
        sellCount: 0,
        totalCount: 0,
        totalShares: 0,
        totalValue: 0
      });
    }

    const day = grouped.get(date);
    day.totalCount += 1;

    if (txType === "BUY") day.buyCount += 1;
    if (txType === "SELL") day.sellCount += 1;
    if (Number.isFinite(shares)) day.totalShares += shares;
    if (Number.isFinite(tradeValue)) day.totalValue += tradeValue;
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) return 0;
    return dateB - dateA;
  });
}

function renderDailySummary(rows) {
  if (!rows.length) {
    dailySummaryEl.innerHTML = "";
    return;
  }

  const dailyRows = summarizeByDay(rows);
  const bodyRows = dailyRows
    .map((day) => `
      <tr>
        <td>${escapeHtml(day.date)}</td>
        <td>${formatInt(day.buyCount)}</td>
        <td>${formatInt(day.sellCount)}</td>
        <td>${formatInt(day.totalCount)}</td>
        <td>${formatInt(day.totalShares)}</td>
        <td>${formatCurrency(day.totalValue)}</td>
      </tr>
    `)
    .join("");

  dailySummaryEl.innerHTML = `
    <h2>Daily Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Buys</th>
          <th>Sells</th>
          <th>Transactions</th>
          <th>Total Shares</th>
          <th>Estimated Value</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
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
      const shares = parseNumber(row.shares);
      const sharePrice = parseNumber(row.share_price);
      return `
        <tr>
          <td>${escapeHtml(row.transaction_date || "-")}</td>
          <td>${escapeHtml(row.executive || "-")}</td>
          <td>${escapeHtml(row.executive_title || "-")}</td>
          <td class="${txClass}">${txType}</td>
          <td>${formatInt(shares)}</td>
          <td>${formatCurrency(sharePrice)}</td>
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

function isTargetDate(rowDate, targetDate) {
  if (!rowDate) return false;
  return String(rowDate).slice(0, 10) === targetDate;
}

function summarizeSymbolForDate(symbol, rows, targetDate) {
  const summary = {
    symbol,
    qtyBuy: 0,
    qtySell: 0,
    valueBuy: 0,
    valueSell: 0
  };

  rows.forEach((row) => {
    if (!isTargetDate(row.transaction_date, targetDate)) return;

    const kind = classifyTransaction(row.transaction_type);
    const shares = parseNumber(row.shares);
    const tradeValue = calculateTradeValue(row);
    const safeShares = Number.isFinite(shares) ? shares : 0;
    const safeTradeValue = Number.isFinite(tradeValue) ? tradeValue : 0;

    if (kind === "BUY") {
      summary.qtyBuy += safeShares;
      summary.valueBuy += safeTradeValue;
    } else if (kind === "SELL") {
      summary.qtySell += safeShares;
      summary.valueSell += safeTradeValue;
    }
  });

  return summary;
}

function renderTop50Summary(rows, targetDate) {
  const bodyRows = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.symbol)}</td>
        <td>${formatInt(row.qtyBuy)}</td>
        <td>${formatInt(row.qtySell)}</td>
        <td>${formatCurrency(row.valueBuy)}</td>
        <td>${formatCurrency(row.valueSell)}</td>
      </tr>
    `)
    .join("");

  top50ResultsEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Qty Buy</th>
          <th>Qty Sell</th>
          <th>Value Buy</th>
          <th>Value Sell</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
  setTop50Status(`Loaded ${rows.length} symbols for ${targetDate}.`);
}

async function fetchInsiderRowsForSymbol(symbol) {
  const url = `${BASE_URL}?function=INSIDER_TRANSACTIONS&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(ALPHA_VANTAGE_API_KEY)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.Note) {
    throw new Error("API limit reached. Upgrade plan or slow requests.");
  }

  if (data["Error Message"]) {
    throw new Error(data["Error Message"]);
  }

  return Array.isArray(data.data) ? data.data : [];
}

async function loadTop50SummaryForDate() {
  const targetDate = top50DateInput.value || getLocalDateString();

  if (ALPHA_VANTAGE_API_KEY === "YOUR_API_KEY_HERE") {
    setTop50Status("Set your Alpha Vantage API key in script.js first.", true);
    return;
  }

  setTop50Status(`Loading 50 symbols for ${targetDate}...`);
  top50ResultsEl.innerHTML = "";
  loadTop50Button.disabled = true;

  const summaries = [];
  const failures = [];
  let rateLimited = false;

  try {
    for (let i = 0; i < TOP_50_SYMBOLS.length; i += 1) {
      const symbol = TOP_50_SYMBOLS[i];
      setTop50Status(`Loading ${symbol} (${i + 1}/${TOP_50_SYMBOLS.length}) for ${targetDate}...`);

      try {
        const rows = await fetchInsiderRowsForSymbol(symbol);
        summaries.push(summarizeSymbolForDate(symbol, rows, targetDate));
      } catch (error) {
        failures.push(symbol);
        summaries.push(summarizeSymbolForDate(symbol, [], targetDate));

        if (String(error.message).toLowerCase().includes("api limit")) {
          rateLimited = true;
          for (let j = i + 1; j < TOP_50_SYMBOLS.length; j += 1) {
            const remainingSymbol = TOP_50_SYMBOLS[j];
            failures.push(remainingSymbol);
            summaries.push(summarizeSymbolForDate(remainingSymbol, [], targetDate));
          }
          break;
        }
      }
    }

    renderTop50Summary(summaries, targetDate);
    if (failures.length) {
      setTop50Status(
        `${rateLimited ? "Rate limit hit. " : ""}Loaded ${summaries.length} symbols for ${targetDate}. Failed: ${failures.join(", ")}`,
        true
      );
    }
  } catch (error) {
    setTop50Status(`Failed to load top 50 summary: ${error.message}`, true);
  } finally {
    loadTop50Button.disabled = false;
  }
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
  alertsEl.innerHTML = "";
  dailySummaryEl.innerHTML = "";
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
    const visibleRows = rows.slice(0, 50);
    renderAlerts(visibleRows, symbol);
    renderDailySummary(visibleRows);
    renderTable(visibleRows);
    setStatus(`Loaded ${visibleRows.length} transactions for ${symbol}.`);
  } catch (error) {
    setStatus(`Failed to load data: ${error.message}`, true);
    alertsEl.innerHTML = "";
    dailySummaryEl.innerHTML = "";
  }
}

loadButton.addEventListener("click", loadInsiderTransactions);
symbolInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadInsiderTransactions();
  }
});

top50DateInput.value = getLocalDateString();
loadTop50Button.addEventListener("click", loadTop50SummaryForDate);
