const incomeCategories = ["Salary", "Freelance", "Interest", "Gift"];
const expenseCategories = ["Food", "Transport", "Shopping", "Bills"];

let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

const typeSelect = document.getElementById("type");
const categorySelect = document.getElementById("category");
const monthFilter = document.getElementById("month-filter");
const categoryFilter = document.getElementById("category-filter");

let lineChart, pieChart;

function saveTransactions() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

function updateCategoryOptions() {
  const list = typeSelect.value === "income" ? incomeCategories : expenseCategories;
  categorySelect.innerHTML = '<option value="">Select Category</option>';
  list.forEach(cat => {
    categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}
typeSelect.addEventListener("change", updateCategoryOptions);
document.addEventListener("DOMContentLoaded", updateCategoryOptions);

function updateFilters() {
  const allCats = [...new Set(transactions.map(t => t.category))];
  categoryFilter.innerHTML = `<option value="">All</option>`;
  allCats.forEach(cat => {
    categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}

function updateList() {
  const list = document.getElementById("transaction-list");
  list.innerHTML = "";

  const month = monthFilter.value;
  const cat = categoryFilter.value;

  let incomeTotal = 0, expenseTotal = 0;

  const filtered = transactions.filter(tx => {
    return (!month || tx.date.startsWith(month)) &&
           (!cat || tx.category === cat);
  });

  filtered.forEach((tx, i) => {
    const li = document.createElement("li");
    li.className = tx.type;
    li.innerHTML = `
      <strong>${tx.type === "income" ? "+" : "-"}$${tx.amount}</strong>
      — ${tx.category} (${tx.date})<br>
      <em>${tx.note || ""}</em><br>
      <button data-id="${i}" class="view-btn">👁️</button>
      <button data-id="${i}" class="delete-btn">🗑️</button>
    `;
    list.appendChild(li);

    incomeTotal += tx.type === "income" ? parseFloat(tx.amount) : 0;
    expenseTotal += tx.type === "expense" ? parseFloat(tx.amount) : 0;

    li.querySelector(".view-btn").onclick = () => openEditModal(i);
    li.querySelector(".delete-btn").onclick = () => deleteTransaction(i);
  });

  document.getElementById("income-total").textContent = "$" + incomeTotal.toFixed(2);
  document.getElementById("expense-total").textContent = "$" + expenseTotal.toFixed(2);
  document.getElementById("balance").textContent = "$" + (incomeTotal - expenseTotal).toFixed(2);

  updateCharts(filtered);
}

function deleteTransaction(i) {
  if (confirm("Delete this transaction?")) {
    transactions.splice(i, 1);
    saveTransactions();
    updateFilters();
    updateList();
  }
}

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

document.getElementById("transaction-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const tx = {
    amount: document.getElementById("amount").value,
    type: typeSelect.value,
    category: categorySelect.value,
    date: document.getElementById("date").value,
    note: document.getElementById("note").value
  };
  transactions.push(tx);
  saveTransactions();
  this.reset();
  updateCategoryOptions();
  updateFilters();
  updateList();
});

document.getElementById("export-btn").addEventListener("click", function () {
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

document.getElementById("dark-mode-toggle").addEventListener("change", function () {
  document.body.classList.toggle("dark", this.checked);
});

monthFilter.addEventListener("input", updateList);
categoryFilter.addEventListener("change", updateList);

// MODAL logic
function openEditModal(index) {
  const tx = transactions[index];
  document.getElementById("edit-id").value = index;
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

document.getElementById("edit-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const id = +document.getElementById("edit-id").value;
  transactions[id] = {
    amount: document.getElementById("edit-amount").value,
    type: document.getElementById("edit-type").value,
    category: document.getElementById("edit-category").value,
    date: document.getElementById("edit-date").value,
    note: document.getElementById("edit-note").value
  };
  saveTransactions();
  updateFilters();
  updateList();
  document.getElementById("modal").classList.add("hidden");
});

document.getElementById("cancel-btn").addEventListener("click", () => {
  document.getElementById("modal").classList.add("hidden");
});

updateFilters();
updateList();
