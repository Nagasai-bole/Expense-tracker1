function formatIndianCurrency(amount) {
  return typeof amount === "number"
    ? "₹" +
        amount.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
    : "N/A";
}

function formatDate(date) {
  const d = new Date(date || 0);
  if (isNaN(d.getTime())) return "N/A";
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

async function loadExpenses() {
  try {
    const response = await fetch("/api/expenses");
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to fetch expenses");
    }
    const expenses = await response.json();
    if (!Array.isArray(expenses)) {
      throw new Error("Invalid expenses data format");
    }
    console.log("Loaded expenses:", expenses);
    expenses.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
    });
    displayExpenses(expenses);
  } catch (error) {
    console.error("Load expenses error:", error);
    showMessage("Error loading expenses: " + error.message, "error");
    displayExpenses([]);
  }
}

function displayExpenses(expenses) {
  const tbody = document.getElementById("expense-list");
  const totalDiv = document.getElementById("total-expenses");
  tbody.innerHTML = "";
  totalDiv.textContent = "";

  if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No expenses found.</td></tr>';
    totalDiv.textContent = "Total: ₹0.00";
    return;
  }

  expenses.forEach((expense) => {
    const date = new Date(expense.date || 0);
    const amount = typeof expense.amount === "number" ? expense.amount : 0;
    const category = expense.category || "N/A";
    const description = expense.description || "";
    const tr = document.createElement("tr");
    tr.setAttribute("data-id", expense.id);
    tr.innerHTML = `
            <td>${formatDate(date)}</td>
            <td>${formatIndianCurrency(amount)}</td>
            <td>${category}</td>
            <td>${description}</td>
            <td><button class="delete-btn" onclick="deleteExpense('${
              expense.id
            }')">Delete</button></td>
          `;
    tbody.appendChild(tr);
  });

  const total = expenses.reduce((sum, exp) => {
    return sum + (typeof exp.amount === "number" ? exp.amount : 0);
  }, 0);
  totalDiv.textContent = `Total: ${formatIndianCurrency(total)}`;
}

async function filterExpenses() {
  const category = document.getElementById("filter-category").value;
  const start = document.getElementById("start-date").value;
  const end = document.getElementById("end-date").value;

  try {
    const params = new URLSearchParams();
    if (category && category.trim() !== "") params.append("category", category);
    if (start) params.append("start", start);
    if (end) params.append("end", end);

    console.log("Sending filter request with params:", params.toString());
    const response = await fetch(`/api/expenses/filter?${params}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to fetch expenses for filtering");
    }
    const expenses = await response.json();
    if (!Array.isArray(expenses)) {
      throw new Error("Invalid expenses data format from filter endpoint");
    }
    console.log("All expenses received for filtering:", expenses);

    let filteredExpenses = [...expenses];
    if (category && category.trim() !== "") {
      console.log("Filtering by category:", category);
      filteredExpenses = filteredExpenses.filter(
        (exp) => exp.category === category
      );
    }
    if (start) {
      const startDate = new Date(start);
      if (isNaN(startDate.getTime())) {
        console.warn("Invalid start date:", start);
      } else {
        console.log("Filtering by start date:", startDate);
        filteredExpenses = filteredExpenses.filter((exp) => {
          const expDate = new Date(exp.date);
          return !isNaN(expDate.getTime()) && expDate >= startDate;
        });
      }
    }
    if (end) {
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      if (isNaN(endDate.getTime())) {
        console.warn("Invalid end date:", end);
      } else {
        console.log("Filtering by end date:", endDate);
        filteredExpenses = filteredExpenses.filter((exp) => {
          const expDate = new Date(exp.date);
          return !isNaN(expDate.getTime()) && expDate <= endDate;
        });
      }
    }

    console.log("Filtered expenses (client-side):", filteredExpenses);
    filteredExpenses.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
    });
    displayExpenses(filteredExpenses);
  } catch (error) {
    console.error("Filter expenses error:", error);
    showMessage("Error filtering expenses: " + error.message, "error");
    displayExpenses([]);
  }
}

document
  .getElementById("expense-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const expense = {
      amount: document.getElementById("amount").value,
      category: document.getElementById("category").value,
      description: document.getElementById("description").value,
    };

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expense),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to add expense");
      }
      showMessage("Expense added successfully", "success");
      document.getElementById("expense-form").reset();
      loadExpenses();
    } catch (error) {
      console.error("Add expense error:", error);
      showMessage("Error adding expense: " + error.message, "error");
    }
  });

async function deleteExpense(expenseId) {
  if (!confirm("Are you sure you want to delete this expense?")) return;

  try {
    const response = await fetch(`/api/expenses/${expenseId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to delete expense");
    }
    showMessage("Expense deleted successfully", "success");
    loadExpenses();
  } catch (error) {
    console.error("Delete expense error:", error);
    showMessage("Error deleting expense: " + error.message, "error");
  }
}

function showMessage(text, type) {
  const messageDiv = document.getElementById("message");
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = "block";
  setTimeout(() => (messageDiv.style.display = "none"), 5000);
}

window.onload = loadExpenses;
