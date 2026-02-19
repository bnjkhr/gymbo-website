import {
  isSupabaseEnabled,
  getSession,
  getCurrentProfile,
  onAuthStateChange,
  signInWithOtp,
  signOut,
  fetchCommunityExercises,
  submitExerciseSubmission,
  upsertVote,
  reportExercise
} from "./supabase-client.js";

const state = {
  builtInCatalog: [],
  customExercises: [],
  communityExercises: [],
  catalog: [],
  muscleGroups: [],
  equipmentTypes: [],
  session: null,
  profile: null,
  workout: {
    name: "",
    workoutType: "standard",
    defaultRestTime: 90,
    exercises: []
  }
};

const el = {
  status: document.getElementById("status"),
  authState: document.getElementById("authState"),
  authEmail: document.getElementById("authEmail"),
  signInBtn: document.getElementById("signInBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  moderationLink: document.getElementById("moderationLink"),
  searchInput: document.getElementById("searchInput"),
  muscleFilter: document.getElementById("muscleFilter"),
  equipmentFilter: document.getElementById("equipmentFilter"),
  catalogList: document.getElementById("catalogList"),
  workoutName: document.getElementById("workoutName"),
  workoutType: document.getElementById("workoutType"),
  defaultRest: document.getElementById("defaultRest"),
  workoutList: document.getElementById("workoutList"),
  exerciseCount: document.getElementById("exerciseCount"),
  exportBtn: document.getElementById("exportBtn"),
  openCustomModalBtn: document.getElementById("openCustomModalBtn"),
  closeCustomModalBtn: document.getElementById("closeCustomModalBtn"),
  cancelCustomBtn: document.getElementById("cancelCustomBtn"),
  customModal: document.getElementById("customModal"),
  customExerciseForm: document.getElementById("customExerciseForm"),
  customName: document.getElementById("customName"),
  customNameEn: document.getElementById("customNameEn"),
  customMuscles: document.getElementById("customMuscles"),
  customEquipment: document.getElementById("customEquipment"),
  customDifficulty: document.getElementById("customDifficulty"),
  customDescription: document.getElementById("customDescription"),
  customDescriptionEn: document.getElementById("customDescriptionEn"),
  customInstructions: document.getElementById("customInstructions"),
  customInstructionsEn: document.getElementById("customInstructionsEn"),
  tabs: document.querySelectorAll(".tab-btn"),
  catalogPanel: document.getElementById("catalogPanel"),
  builderPanel: document.getElementById("builderPanel")
};

function uuid() {
  return crypto.randomUUID();
}

function showStatus(message, isError = false) {
  el.status.textContent = message;
  el.status.style.color = isError ? "#fca5a5" : "#4ade80";
}

function sanitizeFilename(name) {
  const fallback = "gymbo-template";
  const clean = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (clean || fallback) + ".gymbo";
}

function isLoggedIn() {
  return Boolean(state.session?.user?.id);
}

function isModerator() {
  return state.profile?.role === "moderator" || state.profile?.role === "admin";
}

function updateAuthUI() {
  if (!isSupabaseEnabled()) {
    el.authState.textContent = "Supabase nicht konfiguriert. Nutze training/supabase-config.js.";
    el.signInBtn.hidden = true;
    el.signOutBtn.hidden = true;
    el.moderationLink.hidden = true;
    return;
  }

  if (!isLoggedIn()) {
    el.authState.textContent = "Nicht eingeloggt. Community-Submit/Vote/Report ist deaktiviert.";
    el.signInBtn.hidden = false;
    el.signOutBtn.hidden = true;
    el.moderationLink.hidden = true;
    return;
  }

  el.authState.textContent = `Eingeloggt als ${state.session.user.email} (${state.profile?.role || "user"}).`;
  el.signInBtn.hidden = true;
  el.signOutBtn.hidden = false;
  el.moderationLink.hidden = !isModerator();
}

function mapCatalogExercise(raw) {
  return {
    source: "built-in",
    key: `catalog-${raw.id}`,
    name: raw.name,
    nameDe: raw.name,
    nameEn: raw.name,
    muscleGroups: raw.muscleGroups || [],
    equipmentType: raw.equipmentType || "Freie Gewichte",
    difficultyLevel: raw.difficultyLevel || "Fortgeschritten",
    description: raw.description || "",
    descriptionDe: raw.description || "",
    descriptionEn: raw.description || "",
    instructions: raw.instructions || [],
    instructionsDe: raw.instructions || [],
    instructionsEn: raw.instructions || [],
    score: 0,
    reportsCount: 0
  };
}

function mapCommunityExercise(raw) {
  return {
    source: "community",
    communityId: raw.id,
    key: `community-${raw.id}`,
    name: raw.name_de,
    nameDe: raw.name_de,
    nameEn: raw.name_en,
    muscleGroups: raw.muscle_groups || [],
    equipmentType: raw.equipment_type,
    difficultyLevel: raw.difficulty,
    description: raw.description_de || "",
    descriptionDe: raw.description_de || "",
    descriptionEn: raw.description_en || "",
    instructions: raw.instructions_de || [],
    instructionsDe: raw.instructions_de || [],
    instructionsEn: raw.instructions_en || [],
    score: raw.score || 0,
    reportsCount: raw.reports_count || 0
  };
}

function rebuildCatalog() {
  state.catalog = [
    ...state.customExercises,
    ...state.communityExercises,
    ...state.builtInCatalog
  ];
}

function updateMobileTabs(tab) {
  el.tabs.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  el.catalogPanel.classList.toggle("active-mobile", tab === "catalog");
  el.builderPanel.classList.toggle("active-mobile", tab === "builder");
}

function renderFilters() {
  const appendOptions = (selectEl, values) => {
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      selectEl.appendChild(option);
    });
  };

  appendOptions(el.muscleFilter, state.muscleGroups);
  appendOptions(el.equipmentFilter, state.equipmentTypes);

  state.muscleGroups.forEach((muscle) => {
    const wrapper = document.createElement("label");
    wrapper.className = "check-item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = muscle;

    const span = document.createElement("span");
    span.textContent = muscle;

    wrapper.appendChild(input);
    wrapper.appendChild(span);
    el.customMuscles.appendChild(wrapper);
  });

  state.equipmentTypes.forEach((equipment) => {
    const option = document.createElement("option");
    option.value = equipment;
    option.textContent = equipment;
    el.customEquipment.appendChild(option);
  });
}

function getFilteredCatalog() {
  const q = el.searchInput.value.trim().toLowerCase();
  const muscle = el.muscleFilter.value;
  const equipment = el.equipmentFilter.value;

  return state.catalog.filter((exercise) => {
    const nameMatch = exercise.nameDe.toLowerCase().includes(q) || exercise.nameEn.toLowerCase().includes(q);
    const muscleMatch = !muscle || exercise.muscleGroups.includes(muscle);
    const equipmentMatch = !equipment || exercise.equipmentType === equipment;
    return nameMatch && muscleMatch && equipmentMatch;
  });
}

async function handleVote(exercise, vote) {
  if (!isSupabaseEnabled() || !isLoggedIn() || exercise.source !== "community") {
    showStatus("Bitte einloggen, um zu voten.", true);
    return;
  }
  try {
    await upsertVote(exercise.communityId, state.session.user.id, vote);
    await refreshCommunityExercises();
    renderCatalog();
    showStatus("Vote gespeichert.");
  } catch (error) {
    showStatus(error.message || "Vote fehlgeschlagen.", true);
  }
}

async function handleReport(exercise) {
  if (!isSupabaseEnabled() || !isLoggedIn() || exercise.source !== "community") {
    showStatus("Bitte einloggen, um zu melden.", true);
    return;
  }

  const reason = prompt("Report-Grund (wrong_data, duplicate, unsafe, spam, other)", "wrong_data");
  if (!reason) return;
  const normalizedReason = reason.trim();
  const allowed = ["wrong_data", "duplicate", "unsafe", "spam", "other"];
  if (!allowed.includes(normalizedReason)) {
    showStatus("Ungültiger Report-Grund.", true);
    return;
  }
  const details = prompt("Details (optional)", "") || "";

  try {
    await reportExercise(exercise.communityId, state.session.user.id, normalizedReason, details);
    await refreshCommunityExercises();
    renderCatalog();
    showStatus("Report gesendet.");
  } catch (error) {
    showStatus(error.message || "Report fehlgeschlagen.", true);
  }
}

function createCatalogItem(exercise) {
  const item = document.createElement("article");
  item.className = "catalog-item";

  const title = document.createElement("h4");
  title.textContent = exercise.nameDe;

  const meta = document.createElement("div");
  meta.className = "catalog-meta";

  const source = exercise.source === "community" ? "Community" : exercise.source === "custom" ? "Lokal" : "Built-in";
  const sourceClass = exercise.source === "community" ? "catalog-source community" : "catalog-source";
  meta.innerHTML = `<span class="${sourceClass}">${source}</span>${exercise.equipmentType} - ${exercise.muscleGroups.join(", ")}`;

  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-secondary full";
  addBtn.textContent = "Zum Workout";
  addBtn.addEventListener("click", () => {
    addExerciseToWorkout(exercise);
    updateMobileTabs("builder");
  });

  item.appendChild(title);
  item.appendChild(meta);
  item.appendChild(addBtn);

  if (exercise.source === "community") {
    const voteRow = document.createElement("div");
    voteRow.className = "vote-row";
    voteRow.innerHTML = `
      <button class="btn-ghost" data-action="upvote">+1</button>
      <button class="btn-ghost" data-action="downvote">-1</button>
      <button class="btn-ghost" data-action="report">Report</button>
      <span class="vote-score">Score ${exercise.score}, Reports ${exercise.reportsCount}</span>
    `;
    voteRow.querySelector("[data-action='upvote']").addEventListener("click", () => handleVote(exercise, 1));
    voteRow.querySelector("[data-action='downvote']").addEventListener("click", () => handleVote(exercise, -1));
    voteRow.querySelector("[data-action='report']").addEventListener("click", () => handleReport(exercise));
    item.appendChild(voteRow);
  }

  return item;
}

function renderCatalog() {
  const filtered = getFilteredCatalog();
  el.catalogList.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = "Keine Übungen gefunden.";
    empty.className = "catalog-meta";
    el.catalogList.appendChild(empty);
    return;
  }

  filtered.forEach((exercise) => {
    el.catalogList.appendChild(createCatalogItem(exercise));
  });
}

function createDefaultSet(restTime) {
  return {
    id: uuid(),
    reps: 10,
    weight: 0,
    restTime,
    completed: false
  };
}

function addExerciseToWorkout(exercise) {
  const rest = state.workout.defaultRestTime;
  state.workout.exercises.push({
    id: uuid(),
    exercise,
    notes: "",
    sets: [createDefaultSet(rest), createDefaultSet(rest), createDefaultSet(rest)]
  });
  renderWorkout();
}

function removeExercise(workoutExerciseId) {
  state.workout.exercises = state.workout.exercises.filter((e) => e.id !== workoutExerciseId);
  renderWorkout();
}

function moveExercise(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.workout.exercises.length) return;
  const [current] = state.workout.exercises.splice(index, 1);
  state.workout.exercises.splice(nextIndex, 0, current);
  renderWorkout();
}

function addSet(workoutExerciseId) {
  const target = state.workout.exercises.find((e) => e.id === workoutExerciseId);
  if (!target) return;
  target.sets.push(createDefaultSet(state.workout.defaultRestTime));
  renderWorkout();
}

function removeSet(workoutExerciseId, setId) {
  const target = state.workout.exercises.find((e) => e.id === workoutExerciseId);
  if (!target || target.sets.length <= 1) return;
  target.sets = target.sets.filter((s) => s.id !== setId);
  renderWorkout();
}

function groupLabel(index) {
  const base = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return base[index] || `G${index + 1}`;
}

function computeWorkoutGroups(exercises, workoutType, restAfterGroup) {
  if (workoutType === "standard") {
    return { groups: [], groupByExerciseId: new Map() };
  }

  const groups = [];
  const groupByExerciseId = new Map();

  if (workoutType === "superset") {
    for (let i = 0; i < exercises.length; i += 2) {
      const pair = exercises.slice(i, i + 2);
      const groupId = uuid();
      pair.forEach((exercise) => groupByExerciseId.set(exercise.id, groupId));
      groups.push({
        id: groupId,
        groupIndex: groups.length,
        restAfterGroup,
        exerciseIds: pair.map((exercise) => exercise.id)
      });
    }
    return { groups, groupByExerciseId };
  }

  const groupId = uuid();
  exercises.forEach((exercise) => groupByExerciseId.set(exercise.id, groupId));
  groups.push({
    id: groupId,
    groupIndex: 0,
    restAfterGroup,
    exerciseIds: exercises.map((exercise) => exercise.id)
  });
  return { groups, groupByExerciseId };
}

function renderWorkout() {
  el.workoutList.innerHTML = "";
  el.exerciseCount.textContent = String(state.workout.exercises.length);

  const { groupByExerciseId } = computeWorkoutGroups(
    state.workout.exercises,
    state.workout.workoutType,
    state.workout.defaultRestTime
  );
  const groupIndexById = new Map();
  let nextGroupIndex = 0;
  groupByExerciseId.forEach((groupId) => {
    if (!groupIndexById.has(groupId)) {
      groupIndexById.set(groupId, nextGroupIndex++);
    }
  });

  state.workout.exercises.forEach((workoutExercise, index) => {
    const li = document.createElement("li");
    li.className = "workout-item";
    li.draggable = true;
    li.dataset.exerciseId = workoutExercise.id;

    li.addEventListener("dragstart", (event) => {
      li.classList.add("dragging");
      event.dataTransfer.setData("text/plain", workoutExercise.id);
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
    });

    li.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    li.addEventListener("drop", (event) => {
      event.preventDefault();
      const draggedId = event.dataTransfer.getData("text/plain");
      const from = state.workout.exercises.findIndex((x) => x.id === draggedId);
      const to = state.workout.exercises.findIndex((x) => x.id === workoutExercise.id);
      if (from < 0 || to < 0 || from === to) return;
      const [moved] = state.workout.exercises.splice(from, 1);
      state.workout.exercises.splice(to, 0, moved);
      renderWorkout();
    });

    const groupId = groupByExerciseId.get(workoutExercise.id) || null;
    const groupIndex = groupId ? groupIndexById.get(groupId) : -1;

    li.innerHTML = `
      <div class="workout-head">
        <div>
          <p class="workout-title">${index + 1}. ${workoutExercise.exercise.nameDe}</p>
          <p class="workout-sub">${workoutExercise.exercise.equipmentType}</p>
          ${groupId ? `<span class="group-badge">Gruppe ${groupLabel(groupIndex)}</span>` : ""}
        </div>
        <div class="item-actions">
          <button class="btn-ghost" data-action="up">Hoch</button>
          <button class="btn-ghost" data-action="down">Runter</button>
          <button class="btn-danger" data-action="remove">Löschen</button>
        </div>
      </div>
      <div class="set-list"></div>
      <div class="notes">
        <label>
          Notizen
          <textarea rows="2" placeholder="Optional">${workoutExercise.notes || ""}</textarea>
        </label>
      </div>
      <button class="btn btn-secondary full" data-action="add-set">Satz hinzufügen</button>
    `;

    const setList = li.querySelector(".set-list");
    workoutExercise.sets.forEach((setItem, setIndex) => {
      const row = document.createElement("div");
      row.className = "set-row";
      row.innerHTML = `
        <span>${setIndex + 1}</span>
        <input type="number" min="1" value="${setItem.reps}" aria-label="Wiederholungen" />
        <input type="number" min="0" step="0.5" value="${setItem.weight}" aria-label="Gewicht" />
        <input class="rest-wrap" type="number" min="0" step="5" value="${setItem.restTime}" aria-label="Pause" />
        <button class="btn-danger remove-wrap" type="button">x</button>
      `;

      const [repsInput, weightInput, restInput, removeBtn] = row.querySelectorAll("input, button");

      repsInput.addEventListener("change", () => {
        setItem.reps = Number(repsInput.value) || 0;
      });
      weightInput.addEventListener("change", () => {
        setItem.weight = Number(weightInput.value) || 0;
      });
      restInput.addEventListener("change", () => {
        setItem.restTime = Number(restInput.value) || 0;
      });
      removeBtn.addEventListener("click", () => {
        removeSet(workoutExercise.id, setItem.id);
      });

      setList.appendChild(row);
    });

    const noteField = li.querySelector("textarea");
    noteField.addEventListener("change", () => {
      workoutExercise.notes = noteField.value;
    });

    li.querySelector("[data-action='up']").addEventListener("click", () => moveExercise(index, -1));
    li.querySelector("[data-action='down']").addEventListener("click", () => moveExercise(index, 1));
    li.querySelector("[data-action='remove']").addEventListener("click", () => removeExercise(workoutExercise.id));
    li.querySelector("[data-action='add-set']").addEventListener("click", () => addSet(workoutExercise.id));

    el.workoutList.appendChild(li);
  });
}

function openCustomModal() {
  el.customModal.classList.add("open");
  el.customModal.setAttribute("aria-hidden", "false");
}

function closeCustomModal() {
  el.customModal.classList.remove("open");
  el.customModal.setAttribute("aria-hidden", "true");
  el.customExerciseForm.reset();
}

function getSelectedCustomMuscles() {
  const checked = Array.from(el.customMuscles.querySelectorAll("input:checked"));
  return checked.map((input) => input.value);
}

async function refreshCommunityExercises() {
  if (!isSupabaseEnabled()) return;
  try {
    const rows = await fetchCommunityExercises();
    state.communityExercises = rows.map(mapCommunityExercise);
    rebuildCatalog();
  } catch (error) {
    showStatus(`Community konnte nicht geladen werden: ${error.message}`, true);
  }
}

function parseLines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function handleCustomExerciseSubmit(event) {
  event.preventDefault();

  const nameDe = el.customName.value.trim();
  const nameEn = el.customNameEn.value.trim();
  const muscleGroups = getSelectedCustomMuscles();
  const equipmentType = el.customEquipment.value;
  const difficultyLevel = el.customDifficulty.value;
  const descriptionDe = el.customDescription.value.trim();
  const descriptionEn = el.customDescriptionEn.value.trim();
  const instructionsDe = parseLines(el.customInstructions.value);
  const instructionsEn = parseLines(el.customInstructionsEn.value);

  if (!nameDe || !nameEn) {
    showStatus("Name DE und EN sind Pflicht.", true);
    return;
  }

  const exercise = {
    source: "custom",
    key: `custom-${uuid()}`,
    name: nameDe,
    nameDe,
    nameEn,
    muscleGroups: muscleGroups.length ? muscleGroups : ["Ganzkörper"],
    equipmentType,
    difficultyLevel,
    description: descriptionDe,
    descriptionDe,
    descriptionEn,
    instructions: instructionsDe,
    instructionsDe,
    instructionsEn,
    score: 0,
    reportsCount: 0
  };

  state.customExercises.unshift(exercise);
  rebuildCatalog();
  closeCustomModal();
  renderCatalog();
  addExerciseToWorkout(exercise);

  if (isSupabaseEnabled() && isLoggedIn()) {
    try {
      await submitExerciseSubmission(
        {
          name_de: nameDe,
          name_en: nameEn,
          description_de: descriptionDe,
          description_en: descriptionEn,
          instructions_de: instructionsDe,
          instructions_en: instructionsEn,
          muscle_groups: exercise.muscleGroups,
          equipment_type: equipmentType,
          difficulty: difficultyLevel
        },
        state.session.user.id
      );
      showStatus(`Übung gespeichert und zur Moderation eingereicht: ${nameDe}`);
      return;
    } catch (error) {
      showStatus(`Lokal gespeichert, Submission fehlgeschlagen: ${error.message}`, true);
      return;
    }
  }

  showStatus(`Lokal gespeichert: ${nameDe}. Für globale Freigabe bitte einloggen.`);
}

function exportToGymboBundle() {
  const name = state.workout.name.trim();
  if (!name) {
    throw new Error("Workout-Name ist leer.");
  }

  if (state.workout.exercises.length === 0) {
    throw new Error("Mindestens eine Übung ist erforderlich.");
  }

  const now = new Date().toISOString();

  const uniqueExercises = [];
  const seen = new Set();
  state.workout.exercises.forEach((we) => {
    if (seen.has(we.exercise.key)) return;
    seen.add(we.exercise.key);
    uniqueExercises.push(we.exercise);
  });

  const exerciseIdMap = new Map();
  const backupExercises = uniqueExercises.map((exercise) => {
    const exerciseUuid = uuid();
    exerciseIdMap.set(exercise.key, exerciseUuid);
    return {
      id: exerciseUuid,
      name: exercise.nameDe,
      muscleGroupsRaw: exercise.muscleGroups,
      equipmentTypeRaw: exercise.equipmentType,
      difficultyLevelRaw: exercise.difficultyLevel,
      descriptionText: exercise.descriptionDe || "",
      instructions: Array.isArray(exercise.instructionsDe) ? exercise.instructionsDe : [],
      createdAt: now,
      isBuiltIn: exercise.source === "built-in",
      lastUsedWeight: null,
      lastUsedReps: null,
      lastUsedSetCount: null,
      lastUsedDate: null,
      lastUsedRestTime: null
    };
  });

  const { groups, groupByExerciseId } = computeWorkoutGroups(
    state.workout.exercises,
    state.workout.workoutType,
    state.workout.defaultRestTime
  );

  const workoutExercises = state.workout.exercises.map((we, order) => {
    return {
      id: we.id,
      exerciseId: exerciseIdMap.get(we.exercise.key),
      order,
      notes: we.notes || null,
      groupId: groupByExerciseId.get(we.id) || null,
      sets: we.sets.map((setItem) => ({
        id: setItem.id,
        reps: Number(setItem.reps) || 0,
        weight: Number(setItem.weight) || 0,
        restTime: Number(setItem.restTime) || 0,
        completed: false
      }))
    };
  });

  return {
    version: 10,
    createdAt: now,
    appVersion: "web-1.1",
    metadata: {
      deviceName: "GymBo Web",
      deviceModel: "Web",
      osVersion: "Web",
      totalWorkouts: 1,
      totalSessions: 0,
      totalExercises: backupExercises.length,
      backupSizeBytes: null
    },
    workouts: [
      {
        id: uuid(),
        name,
        date: now,
        defaultRestTime: state.workout.defaultRestTime,
        duration: null,
        notes: "",
        isFavorite: false,
        difficultyLevel: null,
        equipmentType: null,
        workoutType: state.workout.workoutType,
        warmupStrategy: null,
        exercises: workoutExercises,
        exerciseGroups: groups,
        folderId: null,
        orderInFolder: null,
        exerciseCount: workoutExercises.length
      }
    ],
    workoutFolders: [],
    exercises: backupExercises,
    sessions: [],
    userProfile: null,
    exerciseRecords: [],
    progressionSuggestions: []
  };
}

function downloadBundle(bundle, filename) {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function refreshAuth() {
  state.session = await getSession();
  state.profile = await getCurrentProfile();
  updateAuthUI();
}

function bindEvents() {
  el.searchInput.addEventListener("input", renderCatalog);
  el.muscleFilter.addEventListener("change", renderCatalog);
  el.equipmentFilter.addEventListener("change", renderCatalog);

  el.workoutName.addEventListener("input", () => {
    state.workout.name = el.workoutName.value;
  });

  el.workoutType.addEventListener("change", () => {
    state.workout.workoutType = el.workoutType.value;
    renderWorkout();
  });

  el.defaultRest.addEventListener("change", () => {
    const value = Number(el.defaultRest.value);
    state.workout.defaultRestTime = Math.max(30, Math.min(300, Number.isFinite(value) ? value : 90));
    el.defaultRest.value = String(state.workout.defaultRestTime);
  });

  el.exportBtn.addEventListener("click", () => {
    try {
      const bundle = exportToGymboBundle();
      const filename = sanitizeFilename(state.workout.name);
      downloadBundle(bundle, filename);
      showStatus("Export erfolgreich. Oeffne die Datei auf deinem iPhone mit GymBo.");
    } catch (error) {
      showStatus(error.message || "Export fehlgeschlagen.", true);
    }
  });

  el.signInBtn.addEventListener("click", async () => {
    const email = el.authEmail.value.trim();
    if (!email) {
      showStatus("Bitte E-Mail für Login eintragen.", true);
      return;
    }
    try {
      await signInWithOtp(email);
      showStatus("Login-Link wurde per E-Mail gesendet.");
    } catch (error) {
      showStatus(error.message || "Login-Link konnte nicht gesendet werden.", true);
    }
  });

  el.signOutBtn.addEventListener("click", async () => {
    try {
      await signOut();
      await refreshAuth();
      showStatus("Ausgeloggt.");
    } catch (error) {
      showStatus(error.message || "Logout fehlgeschlagen.", true);
    }
  });

  el.openCustomModalBtn.addEventListener("click", openCustomModal);
  el.closeCustomModalBtn.addEventListener("click", closeCustomModal);
  el.cancelCustomBtn.addEventListener("click", closeCustomModal);
  el.customExerciseForm.addEventListener("submit", handleCustomExerciseSubmit);

  el.customModal.addEventListener("click", (event) => {
    if (event.target === el.customModal) {
      closeCustomModal();
    }
  });

  el.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      updateMobileTabs(btn.dataset.tab);
    });
  });

  onAuthStateChange(async () => {
    await refreshAuth();
    renderCatalog();
  });
}

async function init() {
  try {
    const response = await fetch("data/exercise_catalog.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Katalog konnte nicht geladen werden.");
    }

    const json = await response.json();
    state.builtInCatalog = (json.exercises || []).map(mapCatalogExercise);
    state.muscleGroups = json.muscleGroups || [];
    state.equipmentTypes = json.equipmentTypes || [];

    rebuildCatalog();
    renderFilters();

    if (isSupabaseEnabled()) {
      await refreshAuth();
      await refreshCommunityExercises();
    } else {
      updateAuthUI();
    }

    renderCatalog();
    renderWorkout();
    bindEvents();
    showStatus("Katalog geladen. Wähle Übungen aus und exportiere dein Template.");
  } catch (error) {
    showStatus(error.message || "Initialisierung fehlgeschlagen.", true);
  }
}

init();
