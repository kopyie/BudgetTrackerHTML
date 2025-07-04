
const incomeCategories = [
  "Salary",
  "Business",
  "Investment",
  "Gift",
  "Interest",
  "Other Income"
];

const expenseCategories = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Health",
  "Education",
  "Entertainment",
  "Other Expense" 
];

const typeSelect = document.getElementById("type");
const categorySelect = document.getElementById("category");

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

// --- MONTH TABS LOGIC ---
let monthRange = "this"; // default

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    monthRange = this.dataset.range;
    loadAndRender();
  });
});

function getMonthRange(range) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (range === "this") {
    return { year, month };
  } else if (range === "last") {
    if (month === 0) { year -= 1; month = 11; } else { month -= 1; }
    return { year, month };
  }
  return null; // for "all"
}

// --- FILTERS ---
function updateFilters(transactions) {
  // No category filter needed anymore
}

// --- LIST RENDER ---
function updateList(transactions) {
  const list = document.getElementById("transaction-list-ul");
  list.innerHTML = "";

  let incomeTotal = 0, expenseTotal = 0;

  const monthObj = getMonthRange(monthRange);
  // Sort by date descending, then by id (optional)
  const filtered = transactions
    .filter(tx => {
      if (!monthObj) return true; // "all"
      const [txYear, txMonth] = tx.date.split('-').map(Number);
      return txYear === monthObj.year && txMonth === monthObj.month + 1;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  // Group by date
  let lastDate = null;
  filtered.forEach((tx) => {
    if (tx.date !== lastDate) {
      // Add date header
      const dateLi = document.createElement("li");
      dateLi.className = "date-header";
      dateLi.textContent = tx.date;
      list.appendChild(dateLi);
      lastDate = tx.date;
    }
    const li = document.createElement("li");
    li.className = tx.type;
    li.style.cursor = "pointer";
    li.innerHTML = `
      <span class="tx-category">${tx.category}</span>
      <span class="tx-amount">${tx.type === "income" ? "+" : "-"}${tx.amount}</span><br>
      <em>${tx.note || ""}</em>
    `;
    li.onclick = () => openEditModal(tx);
    list.appendChild(li);

    incomeTotal += tx.type === "income" ? parseFloat(tx.amount) : 0;
    expenseTotal += tx.type === "expense" ? parseFloat(tx.amount) : 0;
  });

  document.getElementById("income-total").textContent = incomeTotal.toFixed(2);
  document.getElementById("expense-total").textContent = expenseTotal.toFixed(2);
  document.getElementById("balance").textContent = (incomeTotal - expenseTotal).toFixed(2);

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
  typeSelect.value = "expense";
  updateCategoryOptions();
  // Set date to today
  document.getElementById('date').value = new Date().toISOString().slice(0, 10);
});





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

document.getElementById("delete-btn").addEventListener("click", async function () {
  const id = document.getElementById("edit-id").value;
  if (confirm("Are you sure you want to delete this transaction?")) {
    await deleteTransaction(Number(id));
    await loadAndRender();
    document.getElementById("modal").classList.add("hidden");
  }
});

// --- INITIAL LOAD ---
document.addEventListener('DOMContentLoaded', loadAndRender);
