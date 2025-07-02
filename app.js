const incomeCategories = ["Salary", "Freelance", "Interest", "Gift"];
const expenseCategories = ["Food", "Transport", "Shopping", "Bills"];

const typeSelect = document.getElementById("type");
const categorySelect = document.getElementById("category");
const monthFilter = document.getElementById("month-filter");
const categoryFilter = document.getElementById("category-filter");

let lineChart, pieChart;

// --- CATEGORY SELECTS ---
function updateCategoryOptions() {
  const list = typeSelect.value === "income" ? incomeCategories : expenseCategories;
  categorySelect.innerHTML = '<option value="">Select Category</option>';
  list.forEach(cat => {
    categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}
typeSelect.addEventListener("change", updateCategoryOptions);
document.addEventListener("DOMContentLoaded", updateCategoryOptions);

// --- LOCAL DATABASE FUNCTIONS (IndexedDB) ---
const DB_NAME = 'budget-tracker-db';
const STORE_NAME = 'transactions';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function fetchTransactions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addTransaction(transaction) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(transaction);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteTransaction(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function updateTransaction(id, transaction) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ ...transaction, id: Number(id) });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- FILTERS ---
function updateFilters(transactions) {
  const allCats = [...new Set(transactions.map(t => t.category))];
  categoryFilter.innerHTML = `<option value="">All</option>`;
  allCats.forEach(cat => {
    categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}

// --- LIST RENDER ---
function updateList(transactions) {
  const list = document.getElementById("transaction-list-ul");
  list.innerHTML = "";

  const month = monthFilter.value;
  const cat = categoryFilter.value;

  let incomeTotal = 0, expenseTotal = 0;

  const filtered = transactions.filter(tx => {
    return (!month || tx.date.startsWith(month)) &&
           (!cat || tx.category === cat);
  });

  filtered.forEach((tx) => {
    const li = document.createElement("li");
    li.className = tx.type;
    li.innerHTML = `
      <strong>${tx.type === "income" ? "+" : "-"}$${tx.amount}</strong>
      — ${tx.category} (${tx.date})<br>
      <em>${tx.note || ""}</em><br>
      <button data-id="${tx.id}" class="view-btn">👁️</button>
      <button data-id="${tx.id}" class="delete-btn">🗑️</button>
    `;
    list.appendChild(li);

    incomeTotal += tx.type === "income" ? parseFloat(tx.amount) : 0;
    expenseTotal += tx.type === "expense" ? parseFloat(tx.amount) : 0;

    li.querySelector(".view-btn").onclick = () => openEditModal(tx);
    li.querySelector(".delete-btn").onclick = async () => {
      await deleteTransaction(tx.id);
      await loadAndRender();
    };
  });

  document.getElementById("income-total").textContent = "$" + incomeTotal.toFixed(2);
  document.getElementById("expense-total").textContent = "$" + expenseTotal.toFixed(2);
  document.getElementById("balance").textContent = "$" + (incomeTotal - expenseTotal).toFixed(2);

  updateCharts(filtered);
}

// --- CHARTS ---
function updateCharts(data) {
  const dates = {};
  const categories = {};

  data.forEach(tx => {
    if (!dates[tx.date]) dates[tx.date] = { income: 0, expense: 0 };
    dates[tx.date][tx.type] += parseFloat(tx.amount);

    if (tx.type === "expense") {
      categories[tx.category] = (categories[tx.category] || 0) + parseFloat(tx.amount);
    }
  });

  const lineLabels = Object.keys(dates).sort();
  const incomeData = lineLabels.map(d => dates[d].income);
  const expenseData = lineLabels.map(d => dates[d].expense);

  const pieLabels = Object.keys(categories);
  const pieData = pieLabels.map(k => categories[k]);

  if (lineChart) lineChart.destroy();
  if (pieChart) pieChart.destroy();

  if (document.getElementById("line-chart")) {
    lineChart = new Chart(document.getElementById("line-chart"), {
      type: "line",
      data: {
        labels: lineLabels,
        datasets: [
          { label: "Income", data: incomeData, borderColor: "#4caf50", fill: true },
          { label: "Expense", data: expenseData, borderColor: "#f44336", fill: true }
        ]
      }
    });
  }

  if (document.getElementById("pie-chart")) {
    pieChart = new Chart(document.getElementById("pie-chart"), {
      type: "pie",
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieData,
          backgroundColor: ["#ff6384", "#36a2eb", "#ffce56", "#8e44ad", "#4caf50", "#e67e22"]
        }]
      }
    });
  }
}

// --- MAIN LOAD & RENDER ---
async function loadAndRender() {
  const transactions = await fetchTransactions();
  updateFilters(transactions);
  updateList(transactions);
  window._transactions = transactions; // for export and modal
}

// --- FORM SUBMIT ---
document.getElementById('transaction-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const transaction = {
    amount: parseFloat(document.getElementById('amount').value),
    type: document.getElementById('type').value,
    category: document.getElementById('category').value,
    date: document.getElementById('date').value,
    note: document.getElementById('note').value
  };
  await addTransaction(transaction);
  await loadAndRender();
  e.target.reset();
});

// --- EXPORT ---
document.getElementById("export-btn").addEventListener("click", async function () {
  const transactions = window._transactions || await fetchTransactions();
  if (!transactions.length) return alert("Nothing to export!");
  const csv = [["Amount", "Type", "Category", "Date", "Note"], ...transactions.map(tx => [
    tx.amount, tx.type, tx.category, tx.date, tx.note
  ])].map(row => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url, download: "transactions.csv"
  });
  a.click();
  URL.revokeObjectURL(url);
});

// --- DARK MODE ---
document.getElementById("dark-mode-toggle").addEventListener("change", function () {
  document.body.classList.toggle("dark", this.checked);
});

// --- FILTER EVENTS ---
monthFilter.addEventListener("input", loadAndRender);
categoryFilter.addEventListener("change", loadAndRender);

// --- MODAL LOGIC ---
function openEditModal(tx) {
  document.getElementById("edit-id").value = tx.id;
  document.getElementById("edit-amount").value = tx.amount;
  document.getElementById("edit-type").value = tx.type;
  updateEditCategoryOptions();
  document.getElementById("edit-category").value = tx.category;
  document.getElementById("edit-date").value = tx.date;
  document.getElementById("edit-note").value = tx.note;
  document.getElementById("modal").classList.remove("hidden");
}

document.getElementById("edit-type").addEventListener("change", updateEditCategoryOptions);

function updateEditCategoryOptions() {
  const type = document.getElementById("edit-type").value;
  const catList = type === "income" ? incomeCategories : expenseCategories;
  const editCategory = document.getElementById("edit-category");
  editCategory.innerHTML = "";
  catList.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    editCategory.appendChild(opt);
  });
}

document.getElementById("edit-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const id = document.getElementById("edit-id").value;
  const transaction = {
    amount: document.getElementById("edit-amount").value,
    type: document.getElementById("edit-type").value,
    category: document.getElementById("edit-category").value,
    date: document.getElementById("edit-date").value,
    note: document.getElementById("edit-note").value
  };
  await updateTransaction(id, transaction);
  await loadAndRender();
  document.getElementById("modal").classList.add("hidden");
});

document.getElementById("cancel-btn").addEventListener("click", () => {
  document.getElementById("modal").classList.add("hidden");
});

// --- INITIAL LOAD ---
document.addEventListener('DOMContentLoaded', loadAndRender);
