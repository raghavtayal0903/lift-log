import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 1. Replace these values with your Firebase Project Config from console.firebase.google.com
const firebaseConfig = {
  apiKey: "AIzaSyDV-CClphwzSHWaEz57TjUUM292TWImgjU",
  authDomain: "liftlog-7a3cd.firebaseapp.com",
  projectId: "liftlog-7a3cd",
  storageBucket: "liftlog-7a3cd.firebasestorage.app",
  messagingSenderId: "848127500417",
  appId: "1:848127500417:web:dd9eb0c8696cfcabd66d80",
  measurementId: "G-BWWY403WM6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Application State
let currentUser = null;
let allLogs = [];
let unsubscribeLogs = null;
let authMode = "signin";
let activeModalDate = null;
let pendingDeleteId = null;

// DOM Elements
const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const tabSignIn = document.getElementById("tabSignIn");
const tabSignUp = document.getElementById("tabSignUp");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authError = document.getElementById("authError");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const guestSignInBtn = document.getElementById("guestSignInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const userBadge = document.getElementById("userBadge");
const exportCsvBtn = document.getElementById("exportCsvBtn");

const entryDate = document.getElementById("entryDate");
const entryExercise = document.getElementById("entryExercise");
const entryWeight = document.getElementById("entryWeight");
const entryUnit = document.getElementById("entryUnit");
const entryReps = document.getElementById("entryReps");
const entryRemarks = document.getElementById("entryRemarks");
const logForm = document.getElementById("logForm");
const saveEntryBtn = document.getElementById("saveEntryBtn");

const searchInput = document.getElementById("searchInput");
const filterDateInput = document.getElementById("filterDateInput");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const daysGrid = document.getElementById("daysGrid");

const statWorkoutDays = document.getElementById("statWorkoutDays");
const statTotalLogs = document.getElementById("statTotalLogs");
const statTotalVolume = document.getElementById("statTotalVolume");
const statThisWeek = document.getElementById("statThisWeek");

// Day Modal Elements
const dayModal = document.getElementById("dayModal");
const dayModalTitle = document.getElementById("dayModalTitle");
const dayModalTodayBadge = document.getElementById("dayModalTodayBadge");
const dayModalSubtitle = document.getElementById("dayModalSubtitle");
const closeDayModalBtn = document.getElementById("closeDayModalBtn");
const toggleDayAddFormBtn = document.getElementById("toggleDayAddFormBtn");
const dayInlineForm = document.getElementById("dayInlineForm");
const inlineExercise = document.getElementById("inlineExercise");
const inlineWeight = document.getElementById("inlineWeight");
const inlineUnit = document.getElementById("inlineUnit");
const inlineReps = document.getElementById("inlineReps");
const inlineRemarks = document.getElementById("inlineRemarks");
const cancelInlineAddBtn = document.getElementById("cancelInlineAddBtn");
const saveInlineAddBtn = document.getElementById("saveInlineAddBtn");
const dayEntriesList = document.getElementById("dayEntriesList");

// Edit & Delete Modal Elements
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editEntryId = document.getElementById("editEntryId");
const editDate = document.getElementById("editDate");
const editExercise = document.getElementById("editExercise");
const editWeight = document.getElementById("editWeight");
const editUnit = document.getElementById("editUnit");
const editReps = document.getElementById("editReps");
const editRemarks = document.getElementById("editRemarks");
const closeEditModalBtn = document.getElementById("closeEditModalBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveEditBtn = document.getElementById("saveEditBtn");

const deleteModal = document.getElementById("deleteModal");
const deleteConfirmText = document.getElementById("deleteConfirmText");
const closeDeleteModalBtn = document.getElementById("closeDeleteModalBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const toastEl = document.getElementById("toast");

// Helpers
function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split("T")[0];
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return "Unknown Date";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatWeekday(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "long" });
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 3000);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

entryDate.value = getTodayISO();

// Auth Tabs
tabSignIn.addEventListener("click", () => {
  authMode = "signin";
  tabSignIn.classList.add("active");
  tabSignUp.classList.remove("active");
  authSubmitBtn.textContent = "Sign In";
  authError.classList.add("hidden");
});

tabSignUp.addEventListener("click", () => {
  authMode = "signup";
  tabSignUp.classList.add("active");
  tabSignIn.classList.remove("active");
  authSubmitBtn.textContent = "Create Account";
  authError.classList.add("hidden");
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  authSubmitBtn.disabled = true;

  try {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (authMode === "signin") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    authError.textContent = err.message.replace("Firebase: ", "");
    authError.classList.remove("hidden");
  } finally {
    authSubmitBtn.disabled = false;
  }
});

googleSignInBtn.addEventListener("click", async () => {
  authError.classList.add("hidden");
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    authError.textContent = err.message.replace("Firebase: ", "");
    authError.classList.remove("hidden");
  }
});

guestSignInBtn.addEventListener("click", async () => {
  authError.classList.add("hidden");
  try {
    await signInAnonymously(auth);
  } catch (err) {
    authError.textContent = err.message.replace("Firebase: ", "");
    authError.classList.remove("hidden");
  }
});

signOutBtn.addEventListener("click", () => signOut(auth));

// Auth Observer
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (unsubscribeLogs) {
    unsubscribeLogs();
    unsubscribeLogs = null;
  }

  if (user) {
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    userBadge.textContent = user.isAnonymous ? "Guest Session" : (user.email || "Athlete");
    subscribeToWorkouts(user.uid);
  } else {
    allLogs = [];
    appView.classList.add("hidden");
    authView.classList.remove("hidden");
  }
});

// Firestore Collection Reference
function getUserLogsRef(uid) {
  return collection(db, "users", uid, "workouts");
}

function subscribeToWorkouts(uid) {
  loadingState.classList.remove("hidden");
  emptyState.classList.add("hidden");
  daysGrid.innerHTML = "";

  unsubscribeLogs = onSnapshot(
    getUserLogsRef(uid),
    (snapshot) => {
      loadingState.classList.add("hidden");
      allLogs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      allLogs.sort((a, b) => {
        if (a.date !== b.date) return (b.date || "").localeCompare(a.date || "");
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });

      updateStats();
      renderDaysGrid();
      if (activeModalDate && !dayModal.classList.contains("hidden")) {
        renderDayModalContent(activeModalDate);
      }
    },
    (error) => {
      loadingState.classList.add("hidden");
      showToast("Error loading logs: " + error.message);
    }
  );
}

// Quick Chips
document.getElementById("quickChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  entryExercise.value = chip.dataset.ex;
  entryWeight.focus();
});

// Add Exercise Entry
logForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  saveEntryBtn.disabled = true;
  try {
    await addDoc(getUserLogsRef(currentUser.uid), {
      date: entryDate.value,
      exercise: entryExercise.value.trim(),
      weight: parseFloat(entryWeight.value) || 0,
      unit: entryUnit.value,
      reps: parseInt(entryReps.value, 10) || 0,
      remarks: entryRemarks.value.trim(),
      createdAt: serverTimestamp()
    });

    entryExercise.value = "";
    entryWeight.value = "";
    entryReps.value = "";
    entryRemarks.value = "";
    showToast("Exercise added to workout log!");
  } catch (err) {
    showToast("Failed to save: " + err.message);
  } finally {
    saveEntryBtn.disabled = false;
  }
});

// Summary Statistics
function updateStats() {
  const uniqueDays = new Set(allLogs.map((item) => item.date).filter(Boolean));
  statWorkoutDays.textContent = uniqueDays.size;
  statTotalLogs.textContent = allLogs.length;

  let volume = 0;
  allLogs.forEach((item) => {
    volume += (Number(item.weight) || 0) * (Number(item.reps) || 0);
  });
  statTotalVolume.textContent = volume.toLocaleString();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffISO = sevenDaysAgo.toISOString().split("T")[0];
  const weekCount = allLogs.filter((item) => (item.date || "") >= cutoffISO).length;
  statThisWeek.textContent = weekCount;
}

// Filter & Group Logs by Day
function getFilteredLogs() {
  const query = searchInput.value.trim().toLowerCase();
  const dateFilter = filterDateInput.value;

  if (query || dateFilter) {
    clearFiltersBtn.classList.remove("hidden");
  } else {
    clearFiltersBtn.classList.add("hidden");
  }

  return allLogs.filter((item) => {
    const matchesDate = !dateFilter || item.date === dateFilter;
    const matchesQuery =
      !query ||
      (item.exercise || "").toLowerCase().includes(query) ||
      (item.remarks || "").toLowerCase().includes(query);
    return matchesDate && matchesQuery;
  });
}

function renderDaysGrid() {
  const filtered = getFilteredLogs();
  daysGrid.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  const groupsMap = new Map();
  filtered.forEach((entry) => {
    const d = entry.date || "Unknown";
    if (!groupsMap.has(d)) groupsMap.set(d, []);
    groupsMap.get(d).push(entry);
  });

  const sortedDates = Array.from(groupsMap.keys()).sort((a, b) => b.localeCompare(a));
  const todayISO = getTodayISO();

  sortedDates.forEach((dateKey) => {
    const entries = groupsMap.get(dateKey);
    const isToday = dateKey === todayISO;
    const totalReps = entries.reduce((sum, e) => sum + (Number(e.reps) || 0), 0);
    const totalVol = entries.reduce(
      (sum, e) => sum + (Number(e.weight) || 0) * (Number(e.reps) || 0),
      0
    );

    const previewItems = entries.slice(0, 3);
    const extraCount = entries.length - previewItems.length;

    const pillsHtml =
      previewItems
        .map(
          (e) =>
            `<span class="exercise-pill">${escapeHtml(e.exercise)} • ${e.weight}${escapeHtml(e.unit || "kg")} × ${e.reps}</span>`
        )
        .join("") +
      (extraCount > 0 ? `<span class="exercise-pill">+${extraCount} more</span>` : "");

    const card = document.createElement("article");
    card.className = "day-card";
    card.dataset.date = dateKey;
    card.innerHTML = `
      <div>
        <div class="day-card-top">
          <div>
            <div class="day-card-date">${formatDisplayDate(dateKey)}</div>
            <div class="day-card-weekday">${formatWeekday(dateKey)}</div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            ${isToday ? `<span class="badge badge-emerald">Today</span>` : ""}
            <span class="badge badge-slate">${entries.length} ${entries.length === 1 ? "log" : "logs"}</span>
          </div>
        </div>
        <div class="day-pills" style="margin-top:14px;">
          ${pillsHtml}
        </div>
      </div>
      <div class="day-card-footer">
        <span>${totalReps} reps • ${totalVol.toLocaleString()} vol</span>
        <span class="day-card-cta">Open day &rarr;</span>
      </div>
    `;

    card.addEventListener("click", () => openDayModal(dateKey));
    daysGrid.appendChild(card);
  });
}

searchInput.addEventListener("input", renderDaysGrid);
filterDateInput.addEventListener("change", renderDaysGrid);
clearFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  filterDateInput.value = "";
  renderDaysGrid();
});

// ================= DAY DETAILS MODAL =================
function openDayModal(dateKey) {
  activeModalDate = dateKey;
  dayInlineForm.classList.add("hidden");
  dayInlineForm.reset();
  renderDayModalContent(dateKey);
  dayModal.classList.remove("hidden");
}

function closeDayModal() {
  activeModalDate = null;
  dayModal.classList.add("hidden");
}

function renderDayModalContent(dateKey) {
  const dayEntries = allLogs.filter((item) => item.date === dateKey);
  dayModalTitle.textContent = `${formatDisplayDate(dateKey)} (${formatWeekday(dateKey)})`;

  if (dateKey === getTodayISO()) {
    dayModalTodayBadge.classList.remove("hidden");
  } else {
    dayModalTodayBadge.classList.add("hidden");
  }

  const totalVol = dayEntries.reduce(
    (sum, e) => sum + (Number(e.weight) || 0) * (Number(e.reps) || 0),
    0
  );
  dayModalSubtitle.textContent = `${dayEntries.length} ${dayEntries.length === 1 ? "exercise" : "exercises"} logged • Total volume: ${totalVol.toLocaleString()}`;

  if (dayEntries.length === 0) {
    dayEntriesList.innerHTML = `<div class="empty-state">No entries remaining for this day.</div>`;
    return;
  }

  dayEntriesList.innerHTML = dayEntries
    .map(
      (entry) => `
      <div class="entry-row">
        <div class="entry-row-main">
          <h4>${escapeHtml(entry.exercise)}</h4>
          <div class="entry-metrics">
            <span>Weight: ${entry.weight} ${escapeHtml(entry.unit || "kg")}</span>
            <span>&bull;</span>
            <span>Reps: ${entry.reps}</span>
          </div>
          ${entry.remarks ? `<p class="entry-remarks">${escapeHtml(entry.remarks)}</p>` : ""}
        </div>
        <div class="entry-row-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${entry.id}">Edit</button>
          <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${entry.id}">Delete</button>
        </div>
      </div>
    `
    )
    .join("");
}

closeDayModalBtn.addEventListener("click", closeDayModal);
dayModal.addEventListener("click", (e) => {
  if (e.target === dayModal) closeDayModal();
});

toggleDayAddFormBtn.addEventListener("click", () => {
  dayInlineForm.classList.toggle("hidden");
  if (!dayInlineForm.classList.contains("hidden")) {
    inlineExercise.focus();
  }
});

cancelInlineAddBtn.addEventListener("click", () => {
  dayInlineForm.classList.add("hidden");
  dayInlineForm.reset();
});

dayInlineForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser || !activeModalDate) return;

  saveInlineAddBtn.disabled = true;
  try {
    await addDoc(getUserLogsRef(currentUser.uid), {
      date: activeModalDate,
      exercise: inlineExercise.value.trim(),
      weight: parseFloat(inlineWeight.value) || 0,
      unit: inlineUnit.value,
      reps: parseInt(inlineReps.value, 10) || 0,
      remarks: inlineRemarks.value.trim(),
      createdAt: serverTimestamp()
    });
    dayInlineForm.reset();
    dayInlineForm.classList.add("hidden");
    showToast("Added exercise to session!");
  } catch (err) {
    showToast("Error adding entry: " + err.message);
  } finally {
    saveInlineAddBtn.disabled = false;
  }
});

dayEntriesList.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const entry = allLogs.find((item) => item.id === id);
  if (!entry) return;

  if (btn.dataset.action === "edit") {
    openEditModal(entry);
  } else if (btn.dataset.action === "delete") {
    openDeleteModal(entry);
  }
});

// ================= EDIT MODAL =================
function openEditModal(entry) {
  editEntryId.value = entry.id;
  editDate.value = entry.date || getTodayISO();
  editExercise.value = entry.exercise || "";
  editWeight.value = entry.weight ?? 0;
  editUnit.value = entry.unit || "kg";
  editReps.value = entry.reps ?? 1;
  editRemarks.value = entry.remarks || "";
  editModal.classList.remove("hidden");
}

function closeEditModal() {
  editModal.classList.add("hidden");
}

closeEditModalBtn.addEventListener("click", closeEditModal);
cancelEditBtn.addEventListener("click", closeEditModal);
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser || !editEntryId.value) return;

  saveEditBtn.disabled = true;
  try {
    const docRef = doc(db, "users", currentUser.uid, "workouts", editEntryId.value);
    await updateDoc(docRef, {
      date: editDate.value,
      exercise: editExercise.value.trim(),
      weight: parseFloat(editWeight.value) || 0,
      unit: editUnit.value,
      reps: parseInt(editReps.value, 10) || 0,
      remarks: editRemarks.value.trim()
    });
    closeEditModal();
    showToast("Exercise updated!");
  } catch (err) {
    showToast("Update failed: " + err.message);
  } finally {
    saveEditBtn.disabled = false;
  }
});

// ================= DELETE MODAL =================
function openDeleteModal(entry) {
  pendingDeleteId = entry.id;
  deleteConfirmText.textContent = `Delete "${entry.exercise}" (${entry.weight}${entry.unit || "kg"} × ${entry.reps} reps)?`;
  deleteModal.classList.remove("hidden");
}

function closeDeleteModal() {
  pendingDeleteId = null;
  deleteModal.classList.add("hidden");
}

closeDeleteModalBtn.addEventListener("click", closeDeleteModal);
cancelDeleteBtn.addEventListener("click", closeDeleteModal);
deleteModal.addEventListener("click", (e) => {
  if (e.target === deleteModal) closeDeleteModal();
});

confirmDeleteBtn.addEventListener("click", async () => {
  if (!currentUser || !pendingDeleteId) return;

  confirmDeleteBtn.disabled = true;
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "workouts", pendingDeleteId));
    closeDeleteModal();
    showToast("Entry deleted.");
  } catch (err) {
    showToast("Delete failed: " + err.message);
  } finally {
    confirmDeleteBtn.disabled = false;
  }
});

// ================= CSV EXPORT =================
exportCsvBtn.addEventListener("click", () => {
  if (allLogs.length === 0) {
    showToast("No workout logs to export yet.");
    return;
  }

  const headers = ["Date", "Exercise", "Weight", "Unit", "Reps", "Remarks"];
  const rows = allLogs.map((item) => [
    item.date || "",
    `"${(item.exercise || "").replace(/"/g, '""')}"`,
    item.weight ?? 0,
    item.unit || "kg",
    item.reps ?? 0,
    `"${(item.remarks || "").replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `liftlog-workouts-${getTodayISO()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});