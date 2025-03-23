const express = require("express");
const app = express();
const path = require("path");
const bcrypt = require("bcryptjs");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const admin = require("firebase-admin");
const session = require("express-session");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "public")));

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.helloWorld = functions.https.onRequest((req, res) => {
  res.json({ message: "Hello from Firebase!" });
});

const sessionOptions = {
  secret: "mysecretcode",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};
app.use(session(sessionOptions));

const serviceAccount = require("./key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect("/login");
  }
};

app.get("/login", (req, res) => {
  res.render("users/login", { errorMessage: null });
});

app.get("/signUp", (req, res) => {
  res.render("users/signup", { errorMessage: null });
});

app.post("/signUp", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).render("users/signup", {
      errorMessage: "Email and password are required.",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRef = db.collection("users").where("email", "==", email);
    const snapshot = await userRef.get();

    if (!snapshot.empty) {
      return res.render("users/signup", {
        errorMessage: "Email already in use.",
      });
    }

    const docRef = await db.collection("users").add({
      email,
      password: hashedPassword,
    });

    req.session.userId = docRef.id;
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Signup error:", err.message, err.stack);
    res.status(500).render("users/signup", {
      errorMessage: "Signup failed: " + err.message,
    });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render("users/login", {
      errorMessage: "Email and password are required.",
    });
  }

  try {
    const userRef = db.collection("users").where("email", "==", email);
    const snapshot = await userRef.get();

    if (snapshot.empty) {
      return res.render("users/login", { errorMessage: "User not found." });
    }

    const userDoc = snapshot.docs[0];
    const match = await bcrypt.compare(password, userDoc.data().password);

    if (match) {
      req.session.userId = userDoc.id;
      res.redirect("/dashboard");
    } else {
      res.render("users/login", { errorMessage: "Incorrect password." });
    }
  } catch (err) {
    console.error("Login error:", err.message, err.stack);
    res
      .status(500)
      .render("users/login", { errorMessage: "Login failed: " + err.message });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err.message, err.stack);
    }
    res.redirect("/login");
  });
});

const expensesCollection = db.collection("expenses");

app.get("/api/expenses", isAuthenticated, async (req, res) => {
  try {
    const snapshot = await expensesCollection
      .where("userId", "==", req.session.userId)
      .get();
    const expenses = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        amount: data.amount || 0,
        category: data.category || "N/A",
        description: data.description || "",
        date:
          data.date && typeof data.date.toDate === "function"
            ? data.date.toDate()
            : new Date(),
      };
    });
    console.log("Fetched all expenses for /api/expenses:", expenses);
    res.json(expenses);
  } catch (error) {
    console.error("Error fetching expenses:", error.message, error.stack);
    res
      .status(500)
      .json({ error: "Failed to fetch expenses: " + error.message });
  }
});

app.post("/api/expenses", isAuthenticated, async (req, res) => {
  try {
    const { amount, category, description } = req.body;

    if (!amount || !category) {
      return res
        .status(400)
        .json({ error: "Amount and category are required." });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res
        .status(400)
        .json({ error: "Amount must be a positive number." });
    }

    const validCategories = [
      "Food",
      "Transport",
      "Bills",
      "Entertainment",
      "Shopping",
      "Other",
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: "Invalid category." });
    }

    const expense = {
      amount: parsedAmount,
      category,
      description: description || "",
      date: admin.firestore.FieldValue.serverTimestamp(),
      userId: req.session.userId,
    };

    const docRef = await expensesCollection.add(expense);
    const addedExpense = {
      id: docRef.id,
      ...expense,
      date: new Date(),
    };
    console.log("Added expense:", addedExpense);
    res.status(201).json(addedExpense);
  } catch (error) {
    console.error("Error adding expense:", error.message, error.stack);
    res.status(500).json({ error: "Failed to add expense: " + error.message });
  }
});

app.delete("/api/expenses/:id", isAuthenticated, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const expenseRef = expensesCollection.doc(expenseId);
    const doc = await expenseRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Expense not found." });
    }

    const expenseData = doc.data();
    if (expenseData.userId !== req.session.userId) {
      return res
        .status(403)
        .json({ error: "Unauthorized to delete this expense." });
    }

    await expenseRef.delete();
    console.log(`Deleted expense with ID: ${expenseId}`);
    res.status(200).json({ message: "Expense deleted successfully." });
  } catch (error) {
    console.error("Error deleting expense:", error.message, error.stack);
    res
      .status(500)
      .json({ error: "Failed to delete expense: " + error.message });
  }
});

app.get("/api/expenses/filter", isAuthenticated, async (req, res) => {
  try {
    const { category, start, end } = req.query;
    console.log("Filter request received with params:", {
      category,
      start,
      end,
    });

    const snapshot = await expensesCollection
      .where("userId", "==", req.session.userId)
      .get();
    const expenses = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        amount: data.amount || 0,
        category: data.category || "N/A",
        description: data.description || "",
        date:
          data.date && typeof data.date.toDate === "function"
            ? data.date.toDate()
            : new Date(),
      };
    });
    console.log("All expenses sent for client-side filtering:", expenses);
    res.json(expenses);
  } catch (error) {
    console.error(
      "Error fetching expenses for filter:",
      error.message,
      error.stack
    );
    res
      .status(500)
      .json({ error: "Failed to fetch expenses for filter: " + error.message });
  }
});

app.get("/dashboard", isAuthenticated, async (req, res) => {
  try {
    const snapshot = await expensesCollection
      .where("userId", "==", req.session.userId)
      .get();
    const expenses = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        amount: data.amount || 0,
        category: data.category || "N/A",
        description: data.description || "",
        date:
          data.date && typeof data.date.toDate === "function"
            ? data.date.toDate()
            : new Date(),
      };
    });
    expenses.sort((a, b) => b.date - a.date);
    console.log("Expenses sent to dashboard:", expenses);
    res.render("templates/index", { expenses, errorMessage: null });
  } catch (error) {
    console.error("Error loading dashboard:", error.message, error.stack);
    res.render("templates/index", {
      expenses: [],
      errorMessage: "Unable to load expenses: " + error.message,
    });
  }
});

app.listen(8080, () => {
  console.log("App is running on port 8080");
});
