import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDV-CClphwzSHWaEz57TjUUM292TWImgjU",
  authDomain: "liftlog-7a3cd.firebaseapp.com",
  projectId: "liftlog-7a3cd",
  storageBucket: "liftlog-7a3cd.firebasestorage.app",
  messagingSenderId: "848127500417",
  appId: "1:848127500417:web:782e1aa0957708cbd66d80",
  measurementId: "G-2W44N57RNJ",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// DOM Elements
const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const toggleAuthModeBtn = document.getElementById("toggleAuthModeBtn");
const authModePrompt = document.getElementById("authModePrompt");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const authError = document.getElementById("authError");

const userEmailDisplay = document.getElementById("userEmailDisplay");
const signOutBtn = document.getElementById("signOutBtn");

const workoutForm = document.getElementById("workoutForm");
const workoutDate = document.getElementById("workoutDate");
const exerciseName = document.getElementById("exerciseName");
const mainSetsContainer = document.getElementById("mainSetsContainer");
const addMainSetBtn = document.getElementById("addMainSetBtn");
const workoutNotes = document.getElementById("workoutNotes");

const workoutsList = document.getElementById("workoutsList");
const emptyState = document.getElementById("emptyState");

const inlineAddModal = document.getElementById("inlineAddModal");
const inlineAddForm = document.getElementById("inlineAddForm");
const inlineDateDisplay = document.getElementById("inlineDateDisplay");
const inlineDateInput = document.getElementById("inlineDateInput");
const inlineExerciseName = document.getElementById("inlineExerciseName");
const inlineSetsContainer = document.getElementById("inlineSetsContainer");
const addInlineSetBtn = document.getElementById("addInlineSetBtn");
const inlineNotes = document.getElementById("inlineNotes");
const closeInlineModalBtn = document.getElementById("closeInlineModalBtn");

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editWorkoutId = document.getElementById("editWorkoutId");
const editDate = document.getElementById("editDate");
const editExerciseName = document.getElementById("editExerciseName");
const editSetsContainer = document.getElementById("editSetsContainer");
const addEditSetBtn = document.getElementById("addEditSetBtn");
const editNotes = document.getElementById("editNotes");
const closeEditModalBtn = document.getElementById("closeEditModalBtn");

// App State
let isSignUpMode = false;
let currentUser = null;
let unsubscribeWorkouts = null;
let allWorkouts = [];

// Helpers
function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

function formatDateHeading(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.remove("hidden");
}

function clearAuthError() {
  authError.textContent = "";
  authError.classList.add("hidden");
}

function renumberSetRows(container) {
  const rows = container.querySelectorAll(".set-row");
  rows.forEach((row, idx) => {
    const badge = row.querySelector(".set-badge");
    if (badge) badge.textContent = `Set ${idx + 1}`;
  });
}

function createSetRow(container, weight = "", reps = "") {
  const row = document.createElement("div");
  row.className = "set-row";

  row.innerHTML = `
    <span class="set-badge">Set</span>
    <input type="number" step="0.5" min="0" class="set-weight" placeholder="Weight (kg)" value="${weight}" required />
    <input type="number" step="1" min="1" class="set-reps" placeholder="Reps" value="${reps}" required />
    <button type="button" class="btn btn-small btn-danger remove-set-btn" aria-label="Remove set">&times;</button>
  `;

  row.querySelector(".remove-set-btn").addEventListener("click", () => {
    if (container.querySelectorAll(".set-row").length > 1) {
      row.remove();
      renumberSetRows(container);
    }
  });

  container.appendChild(row);
  renumberSetRows(container);
}

function collectSets(container) {
  const rows = container.querySelectorAll(".set-row");
  const sets = [];
  rows.forEach((row) => {
    const weight = parseFloat(row.querySelector(".set-weight").value);
    const reps = parseInt(row.querySelector(".set-reps").value, 10);
    if (!Number.isNaN(weight) && !Number.isNaN(reps) && reps > 0) {
      sets.push({ weight, reps });
    }
  });
  return sets;
}

function resetSetContainer(container, sets = [{ weight: "", reps: "" }]) {
  container.innerHTML = "";
  sets.forEach((s) => createSetRow(container, s.weight, s.reps));
}

function attachAddSetButton(btn, container) {
  if (!btn || !container) return;
  btn.addEventListener("click", () => createSetRow(container));
}

// Initialize default date & set rows
workoutDate.value = getTodayISO();
resetSetContainer(mainSetsContainer);
attachAddSetButton(addMainSetBtn, mainSetsContainer);
attachAddSetButton(addInlineSetBtn, inlineSetsContainer);
attachAddSetButton(addEditSetBtn, editSetsContainer);

// Auth Events
toggleAuthModeBtn.addEventListener("click", () => {
  isSignUpMode = !isSignUpMode;
  clearAuthError();
  authSubmitBtn.textContent = isSignUpMode ? "Create Account" : "Sign In";
  authModePrompt.textContent = isSignUpMode
    ? "Already have an account?"
    : "Don't have an account?";
  toggleAuthModeBtn.textContent = isSignUpMode ? "Sign In" : "Create Account";
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAuthError();
  const email = authEmail.value.trim();
  const password = authPassword.value;

  try {
    if (isSignUpMode) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    authForm.reset();
  } catch (err) {
    showAuthError(err.message);
  }
});

googleSignInBtn.addEventListener("click", async () => {
  clearAuthError();
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    showAuthError(err.message);
  }
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// Firestore Helpers
function userWorkoutsCol() {
  return collection(db, "users", currentUser.uid, "workouts");
}

function renderWorkouts() {
  workoutsList.innerHTML = "";

  if (allWorkouts.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  // Group by date (newest first)
  const grouped = new Map();
  allWorkouts.forEach((w) => {
    const key = w.date || "Unknown Date";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(w);
  });

  const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));

  sortedDates.forEach((dateKey) => {
    const dayCard = document.createElement("div");
    dayCard.className = "card";

    const header = document.createElement("div");
    header.className = "day-card-header";
    header.innerHTML = `
      <span class="day-title">${formatDateHeading(dateKey)}</span>
      <button type="button" class="btn btn-small btn-secondary">+ Add Exercise</button>
    `;
    header.querySelector("button").addEventListener("click", () => openInlineAddModal(dateKey));
    dayCard.appendChild(header);

    const list = document.createElement("div");
    list.className = "exercise-list";

    grouped.get(dateKey).forEach((workout) => {
      const item = document.createElement("div");
      item.className = "exercise-item";

      const setsArray = Array.isArray(workout.sets) ? workout.sets : [];
      const pillsHtml = setsArray
        .map((s, i) => `<span class="set-pill">S${i + 1}: ${s.weight}kg × ${s.reps}</span>`)
        .join("");

      item.innerHTML = `
        <div class="exercise-top">
          <span class="exercise-name"></span>
          <div class="exercise-actions">
            <button type="button" class="btn btn-small btn-outline edit-btn">Edit</button>
            <button type="button" class="btn btn-small btn-danger delete-btn">Delete</button>
          </div>
        </div>
        <div class="set-pills">${pillsHtml}</div>
        ${workout.notes ? `<p class="exercise-notes"></p>` : ""}
      `;

      item.querySelector(".exercise-name").textContent = workout.exercise;
      if (workout.notes) {
        item.querySelector(".exercise-notes").textContent = workout.notes;
      }

      item.querySelector(".edit-btn").addEventListener("click", () => openEditModal(workout));
      item.querySelector(".delete-btn").addEventListener("click", () => deleteWorkout(workout.id));

      list.appendChild(item);
    });

    dayCard.appendChild(list);
    workoutsList.appendChild(dayCard);
  });
}

// Create Workout (Main Form)
workoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const sets = collectSets(mainSetsContainer);
  if (sets.length === 0) return;

  await addDoc(userWorkoutsCol(), {
    date: workoutDate.value,
    exercise: exerciseName.value.trim(),
    sets,
    notes: workoutNotes.value.trim(),
    createdAt: serverTimestamp(),
  });

  exerciseName.value = "";
  workoutNotes.value = "";
  resetSetContainer(mainSetsContainer);
});

// Inline Add Modal
function openInlineAddModal(dateKey) {
  inlineDateInput.value = dateKey;
  inlineDateDisplay.textContent = formatDateHeading(dateKey);
  inlineExerciseName.value = "";
  inlineNotes.value = "";
  resetSetContainer(inlineSetsContainer);
  inlineAddModal.classList.remove("hidden");
}

closeInlineModalBtn.addEventListener("click", () => {
  inlineAddModal.classList.add("hidden");
});

inlineAddForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const sets = collectSets(inlineSetsContainer);
  if (sets.length === 0) return;

  await addDoc(userWorkoutsCol(), {
    date: inlineDateInput.value,
    exercise: inlineExerciseName.value.trim(),
    sets,
    notes: inlineNotes.value.trim(),
    createdAt: serverTimestamp(),
  });

  inlineAddModal.classList.add("hidden");
});

// Edit Modal
function openEditModal(workout) {
  editWorkoutId.value = workout.id;
  editDate.value = workout.date || getTodayISO();
  editExerciseName.value = workout.exercise || "";
  editNotes.value = workout.notes || "";
  const existingSets =
    Array.isArray(workout.sets) && workout.sets.length > 0
      ? workout.sets
      : [{ weight: "", reps: "" }];
  resetSetContainer(editSetsContainer, existingSets);
  editModal.classList.remove("hidden");
}

closeEditModalBtn.addEventListener("click", () => {
  editModal.classList.add("hidden");
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const id = editWorkoutId.value;
  const sets = collectSets(editSetsContainer);
  if (!id || sets.length === 0) return;

  await updateDoc(doc(db, "users", currentUser.uid, "workouts", id), {
    date: editDate.value,
    exercise: editExerciseName.value.trim(),
    sets,
    notes: editNotes.value.trim(),
  });

  editModal.classList.add("hidden");
});

// Delete Workout
async function deleteWorkout(id) {
  if (!currentUser) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "workouts", id));
}

// Auth State Listener
onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (unsubscribeWorkouts) {
    unsubscribeWorkouts();
    unsubscribeWorkouts = null;
  }

  if (user) {
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    userEmailDisplay.textContent = user.email || "";

    const q = query(userWorkoutsCol(), orderBy("createdAt", "desc"));
    unsubscribeWorkouts = onSnapshot(q, (snapshot) => {
      allWorkouts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderWorkouts();
    });
  } else {
    allWorkouts = [];
    workoutsList.innerHTML = "";
    appSection.classList.add("hidden");
    authSection.classList.remove("hidden");
  }
});