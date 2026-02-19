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
  reportExercise,
  fetchUserWorkouts,
  upsertUserWorkout,
  deleteUserWorkout,
  submitWorkoutToCommunity,
  fetchCommunityWorkouts
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
  myWorkouts: [],
  communityWorkouts: [],
  editingWorkoutId: null,
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
  localOnlyHint: document.getElementById("localOnlyHint"),
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
  saveWorkoutBtn: document.getElementById("saveWorkoutBtn"),
  submitWorkoutBtn: document.getElementById("submitWorkoutBtn"),
  deleteWorkoutBtn: document.getElementById("deleteWorkoutBtn"),
  myWorkoutCount: document.getElementById("myWorkoutCount"),
  myWorkoutsList: document.getElementById("myWorkoutsList"),
  communityWorkoutCount: document.getElementById("communityWorkoutCount"),
  communityWorkoutsList: document.getElementById("communityWorkoutsList"),
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showPromptModal(title, options, placeholder) {
  return new Promise((resolve) => {
    const modal = document.getElementById("promptModal");
    const titleEl = modal.querySelector(".prompt-title");
    const select = modal.querySelector(".prompt-select");
    const input = modal.querySelector(".prompt-input");
    const confirmBtn = modal.querySelector("[data-action='confirm']");
    const cancelBtn = modal.querySelector("[data-action='cancel']");

    titleEl.textContent = title;
    input.value = "";
    input.placeholder = placeholder || "";

    if (options) {
      select.innerHTML = "";
      options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        select.appendChild(o);
      });
      select.hidden = false;
    } else {
      select.hidden = true;
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    function cleanup() {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
    }

    function onConfirm() {
      cleanup();
      resolve({ confirmed: true, selected: select.hidden ? null : select.value, text: input.value });
    }

    function onCancel() {
      cleanup();
      resolve({ confirmed: false });
    }

    function onBackdrop(e) {
      if (e.target === modal) onCancel();
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
  });
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
    el.authState.textContent = "Supabase ist nicht konfiguriert. Nutze training/supabase-config.js.";
    el.signInBtn.hidden = true;
    el.signOutBtn.hidden = true;
    el.moderationLink.hidden = true;
    el.localOnlyHint.hidden = false;
    return;
  }

  if (!isLoggedIn()) {
    el.authState.textContent = "Nicht eingeloggt. Community- und Workout-Cloud-Funktionen sind deaktiviert.";
    el.signInBtn.hidden = false;
    el.signOutBtn.hidden = true;
    el.moderationLink.hidden = true;
    el.localOnlyHint.hidden = false;
    return;
  }

  el.authState.textContent = `Eingeloggt als ${state.session.user.email} (${state.profile?.role || "user"}).`;
  el.signInBtn.hidden = true;
  el.signOutBtn.hidden = false;
  el.moderationLink.hidden = !isModerator();
  el.localOnlyHint.hidden = true;
}

function mapCatalogExercise(raw) {
  return {
    source: "built-in",
    key: `catalog-${raw.id}`,
    nameDe: raw.name,
    nameEn: raw.nameEn || raw.name,
    muscleGroups: raw.muscleGroups || [],
    equipmentType: raw.equipmentType || "Freie Gewichte",
    difficultyLevel: raw.difficultyLevel || "Fortgeschritten",
    descriptionDe: raw.description || "",
    descriptionEn: raw.description || "",
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
    nameDe: raw.name_de,
    nameEn: raw.name_en,
    muscleGroups: raw.muscle_groups || [],
    equipmentType: raw.equipment_type,
    difficultyLevel: raw.difficulty,
    descriptionDe: raw.description_de || "",
    descriptionEn: raw.description_en || "",
    instructionsDe: raw.instructions_de || [],
    instructionsEn: raw.instructions_en || [],
    score: raw.score || 0,
    reportsCount: raw.reports_count || 0
  };
}

function cloneExerciseForStorage(exercise) {
  return {
    source: exercise.source,
    communityId: exercise.communityId || null,
    key: exercise.key,
    nameDe: exercise.nameDe,
    nameEn: exercise.nameEn,
    muscleGroups: [...exercise.muscleGroups],
    equipmentType: exercise.equipmentType,
    difficultyLevel: exercise.difficultyLevel,
    descriptionDe: exercise.descriptionDe,
    descriptionEn: exercise.descriptionEn,
    instructionsDe: [...exercise.instructionsDe],
    instructionsEn: [...exercise.instructionsEn]
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
  const communityPanel = document.getElementById("community-workouts");
  if (communityPanel) {
    communityPanel.classList.toggle("active-mobile", tab === "community");
  }
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

  const result = await showPromptModal("Report-Grund wählen", [
    { value: "wrong_data", label: "Falsche Daten" },
    { value: "duplicate", label: "Duplikat" },
    { value: "unsafe", label: "Unsicher" },
    { value: "spam", label: "Spam" },
    { value: "other", label: "Sonstiges" }
  ], "Details (optional)");
  if (!result.confirmed) return;
  const normalizedReason = result.selected;
  const details = result.text || "";

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
  meta.innerHTML = `<span class="${sourceClass}">${source}</span>${escapeHtml(exercise.equipmentType)} - ${escapeHtml(exercise.muscleGroups.join(", "))}`;

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
    exercise: cloneExerciseForStorage(exercise),
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
  el.deleteWorkoutBtn.hidden = !state.editingWorkoutId;

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

    li.addEventListener("dragstart", (event) => {
      li.classList.add("dragging");
      event.dataTransfer.setData("text/plain", workoutExercise.id);
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));
    li.addEventListener("dragover", (event) => event.preventDefault());
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
          <p class="workout-title">${index + 1}. ${escapeHtml(workoutExercise.exercise.nameDe)}</p>
          <p class="workout-sub">${escapeHtml(workoutExercise.exercise.equipmentType)}</p>
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
        <label>Notizen<textarea rows="2" placeholder="Optional">${escapeHtml(workoutExercise.notes || "")}</textarea></label>
      </div>
      <button class="btn btn-secondary full" data-action="add-set">Satz hinzufügen</button>
    `;

    const setList = li.querySelector(".set-list");
    const setHeader = document.createElement("div");
    setHeader.className = "set-row-header";
    setHeader.innerHTML = `<span>#</span><span>Wdh.</span><span>Gew.</span><span>Pause</span><span></span>`;
    setList.appendChild(setHeader);
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
      repsInput.addEventListener("change", () => (setItem.reps = Number(repsInput.value) || 0));
      weightInput.addEventListener("change", () => (setItem.weight = Number(weightInput.value) || 0));
      restInput.addEventListener("change", () => (setItem.restTime = Number(restInput.value) || 0));
      removeBtn.addEventListener("click", () => removeSet(workoutExercise.id, setItem.id));
      setList.appendChild(row);
    });

    li.querySelector("textarea").addEventListener("change", (e) => {
      workoutExercise.notes = e.target.value;
    });
    li.querySelector("[data-action='up']").addEventListener("click", () => moveExercise(index, -1));
    li.querySelector("[data-action='down']").addEventListener("click", () => moveExercise(index, 1));
    li.querySelector("[data-action='remove']").addEventListener("click", () => {
      if (confirm(`„${workoutExercise.exercise.nameDe}" aus dem Workout entfernen?`)) {
        removeExercise(workoutExercise.id);
      }
    });
    li.querySelector("[data-action='add-set']").addEventListener("click", () => addSet(workoutExercise.id));

    el.workoutList.appendChild(li);
  });
}

function getSelectedCustomMuscles() {
  const checked = Array.from(el.customMuscles.querySelectorAll("input:checked"));
  return checked.map((input) => input.value);
}

function parseLines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
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

function getBuilderPayload() {
  return {
    name: state.workout.name.trim(),
    workoutType: state.workout.workoutType,
    defaultRestTime: state.workout.defaultRestTime,
    exercises: state.workout.exercises.map((we) => ({
      id: we.id,
      notes: we.notes || "",
      exercise: cloneExerciseForStorage(we.exercise),
      sets: we.sets.map((s) => ({ ...s }))
    }))
  };
}

function loadBuilderPayload(payload, workoutId = null) {
  state.editingWorkoutId = workoutId;
  state.workout.name = payload.name || "";
  state.workout.workoutType = payload.workoutType || "standard";
  state.workout.defaultRestTime = Number(payload.defaultRestTime) || 90;
  state.workout.exercises = (payload.exercises || []).map((we) => ({
    id: we.id || uuid(),
    notes: we.notes || "",
    exercise: {
      source: we.exercise?.source || "custom",
      communityId: we.exercise?.communityId || null,
      key: we.exercise?.key || `loaded-${uuid()}`,
      nameDe: we.exercise?.nameDe || "Unbekannt",
      nameEn: we.exercise?.nameEn || we.exercise?.nameDe || "Unknown",
      muscleGroups: we.exercise?.muscleGroups || ["Ganzkörper"],
      equipmentType: we.exercise?.equipmentType || "Freie Gewichte",
      difficultyLevel: we.exercise?.difficultyLevel || "Fortgeschritten",
      descriptionDe: we.exercise?.descriptionDe || "",
      descriptionEn: we.exercise?.descriptionEn || "",
      instructionsDe: we.exercise?.instructionsDe || [],
      instructionsEn: we.exercise?.instructionsEn || []
    },
    sets: (we.sets || []).map((s) => ({
      id: s.id || uuid(),
      reps: Number(s.reps) || 0,
      weight: Number(s.weight) || 0,
      restTime: Number(s.restTime) || 0,
      completed: false
    }))
  }));

  el.workoutName.value = state.workout.name;
  el.workoutType.value = state.workout.workoutType;
  el.defaultRest.value = String(state.workout.defaultRestTime);
  renderWorkout();
}

async function saveCurrentWorkout() {
  if (!isSupabaseEnabled() || !isLoggedIn()) {
    showStatus("Ohne Login kann das Workout nicht dauerhaft gesichert werden (nur aktuelle Sitzung im Browser-Tab).", true);
    return null;
  }

  const payload = getBuilderPayload();
  if (!payload.name) {
    showStatus("Workout-Name ist leer.", true);
    return null;
  }
  if (payload.exercises.length === 0) {
    showStatus("Mindestens eine Übung ist erforderlich.", true);
    return null;
  }

  try {
    const workoutId = await upsertUserWorkout(state.session.user.id, state.editingWorkoutId, payload);
    state.editingWorkoutId = workoutId;
    await refreshMyWorkouts();
    renderWorkout();
    showStatus("Workout gesichert.");
    return workoutId;
  } catch (error) {
    showStatus(error.message || "Workout konnte nicht gesichert werden.", true);
    return null;
  }
}

async function deleteCurrentWorkout() {
  if (!state.editingWorkoutId || !isLoggedIn()) return;
  if (!confirm("Dieses Workout wirklich löschen?")) return;
  try {
    await deleteUserWorkout(state.editingWorkoutId, state.session.user.id);
    state.editingWorkoutId = null;
    state.workout = { name: "", workoutType: "standard", defaultRestTime: 90, exercises: [] };
    el.workoutName.value = "";
    el.workoutType.value = "standard";
    el.defaultRest.value = "90";
    renderWorkout();
    await refreshMyWorkouts();
    showStatus("Workout gelöscht.");
  } catch (error) {
    showStatus(error.message || "Workout konnte nicht gelöscht werden.", true);
  }
}

async function submitCurrentWorkoutToCommunity() {
  if (!isSupabaseEnabled() || !isLoggedIn()) {
    showStatus("Bitte einloggen, um Workouts einzureichen.", true);
    return;
  }

  let workoutId = state.editingWorkoutId;
  if (!workoutId) {
    workoutId = await saveCurrentWorkout();
    if (!workoutId) return;
  }

  try {
    await submitWorkoutToCommunity(workoutId, state.session.user.id, getBuilderPayload());
    showStatus("Workout zur Community-Moderation eingereicht.");
  } catch (error) {
    showStatus(error.message || "Einreichung fehlgeschlagen.", true);
  }
}

function exportToGymboBundle(payload) {
  const name = (payload.name || "").trim();
  if (!name) throw new Error("Workout-Name ist leer.");
  if (!payload.exercises?.length) throw new Error("Mindestens eine Übung ist erforderlich.");

  const now = new Date().toISOString();
  const exerciseMap = new Map();

  payload.exercises.forEach((we) => {
    const key = we.exercise.key;
    if (!exerciseMap.has(key)) {
      exerciseMap.set(key, {
        id: uuid(),
        exercise: we.exercise
      });
    }
  });

  const { groups, groupByExerciseId } = computeWorkoutGroups(payload.exercises, payload.workoutType, payload.defaultRestTime);

  const workoutExercises = payload.exercises.map((we, order) => ({
    id: we.id,
    exerciseId: exerciseMap.get(we.exercise.key).id,
    order,
    notes: we.notes || null,
    groupId: groupByExerciseId.get(we.id) || null,
    sets: we.sets.map((s) => ({
      id: s.id,
      reps: Number(s.reps) || 0,
      weight: Number(s.weight) || 0,
      restTime: Number(s.restTime) || 0,
      completed: false
    }))
  }));

  const backupExercises = Array.from(exerciseMap.values()).map((entry) => ({
    id: entry.id,
    name: entry.exercise.nameDe,
    muscleGroupsRaw: entry.exercise.muscleGroups,
    equipmentTypeRaw: entry.exercise.equipmentType,
    difficultyLevelRaw: entry.exercise.difficultyLevel,
    descriptionText: entry.exercise.descriptionDe || "",
    instructions: entry.exercise.instructionsDe || [],
    createdAt: now,
    isBuiltIn: entry.exercise.source === "built-in",
    lastUsedWeight: null,
    lastUsedReps: null,
    lastUsedSetCount: null,
    lastUsedDate: null,
    lastUsedRestTime: null
  }));

  return {
    version: 10,
    createdAt: now,
    appVersion: "web-1.2",
    metadata: {
      deviceName: "GymBo Web",
      deviceModel: "Web",
      osVersion: "Web",
      totalWorkouts: 1,
      totalSessions: 0,
      totalExercises: backupExercises.length,
      backupSizeBytes: null
    },
    workouts: [{
      id: uuid(),
      name,
      date: now,
      defaultRestTime: payload.defaultRestTime,
      duration: null,
      notes: "",
      isFavorite: false,
      difficultyLevel: null,
      equipmentType: null,
      workoutType: payload.workoutType,
      warmupStrategy: null,
      exercises: workoutExercises,
      exerciseGroups: groups,
      folderId: null,
      orderInFolder: null,
      exerciseCount: workoutExercises.length
    }],
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

function renderMyWorkouts() {
  el.myWorkoutsList.innerHTML = "";
  el.myWorkoutCount.textContent = String(state.myWorkouts.length);

  if (!state.myWorkouts.length) {
    const empty = document.createElement("p");
    empty.className = "catalog-meta";
    empty.textContent = "Noch keine gespeicherten Workouts.";
    el.myWorkoutsList.appendChild(empty);
    return;
  }

  state.myWorkouts.forEach((workout) => {
    const item = document.createElement("article");
    item.className = "catalog-item";
    item.innerHTML = `
      <h4>${escapeHtml(workout.name)}</h4>
      <div class="catalog-meta">${escapeHtml(workout.workout_type)} · Aktualisiert ${new Date(workout.updated_at).toLocaleString("de-DE")}</div>
      <div class="vote-row">
        <button class="btn-ghost" data-action="load">Bearbeiten</button>
        <button class="btn-ghost" data-action="submit">Community</button>
        <button class="btn-ghost" data-action="export">Exportieren</button>
        <button class="btn-danger" data-action="delete">Löschen</button>
      </div>
    `;

    item.querySelector("[data-action='load']").addEventListener("click", () => {
      loadBuilderPayload(workout.payload, workout.id);
      showStatus(`Workout geladen: ${workout.name}`);
      updateMobileTabs("builder");
    });

    item.querySelector("[data-action='submit']").addEventListener("click", async () => {
      try {
        await submitWorkoutToCommunity(workout.id, state.session.user.id, workout.payload);
        showStatus(`Workout eingereicht: ${workout.name}`);
      } catch (error) {
        showStatus(error.message || "Einreichung fehlgeschlagen.", true);
      }
    });

    item.querySelector("[data-action='export']").addEventListener("click", () => {
      try {
        const bundle = exportToGymboBundle(workout.payload);
        downloadBundle(bundle, sanitizeFilename(workout.name));
        showStatus(`Exportiert: ${workout.name}`);
      } catch (error) {
        showStatus(error.message || "Export fehlgeschlagen.", true);
      }
    });

    item.querySelector("[data-action='delete']").addEventListener("click", async () => {
      if (!confirm(`Workout „${workout.name}“ löschen?`)) return;
      try {
        await deleteUserWorkout(workout.id, state.session.user.id);
        if (state.editingWorkoutId === workout.id) {
          state.editingWorkoutId = null;
        }
        await refreshMyWorkouts();
        renderWorkout();
        showStatus(`Gelöscht: ${workout.name}`);
      } catch (error) {
        showStatus(error.message || "Löschen fehlgeschlagen.", true);
      }
    });

    el.myWorkoutsList.appendChild(item);
  });
}

function renderCommunityWorkouts() {
  el.communityWorkoutsList.innerHTML = "";
  el.communityWorkoutCount.textContent = String(state.communityWorkouts.length);

  if (!state.communityWorkouts.length) {
    const empty = document.createElement("p");
    empty.className = "catalog-meta";
    empty.textContent = "Noch keine Community-Workouts verfügbar.";
    el.communityWorkoutsList.appendChild(empty);
    return;
  }

  state.communityWorkouts.forEach((workout) => {
    const item = document.createElement("article");
    item.className = "catalog-item";
    const exercisesCount = Array.isArray(workout.payload?.exercises) ? workout.payload.exercises.length : 0;
    item.innerHTML = `
      <h4>${escapeHtml(workout.name)}</h4>
      <div class="catalog-meta">${escapeHtml(workout.workout_type)} · ${exercisesCount} Übungen</div>
      <div class="vote-row">
        <button class="btn-ghost" data-action="load">In Builder laden</button>
        <button class="btn-ghost" data-action="export">Exportieren</button>
      </div>
    `;

    item.querySelector("[data-action='load']").addEventListener("click", () => {
      loadBuilderPayload(workout.payload, null);
      showStatus(`Community-Workout geladen: ${workout.name}`);
      updateMobileTabs("builder");
    });

    item.querySelector("[data-action='export']").addEventListener("click", () => {
      try {
        const bundle = exportToGymboBundle(workout.payload);
        downloadBundle(bundle, sanitizeFilename(workout.name));
        showStatus(`Exportiert: ${workout.name}`);
      } catch (error) {
        showStatus(error.message || "Export fehlgeschlagen.", true);
      }
    });

    el.communityWorkoutsList.appendChild(item);
  });
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

async function refreshMyWorkouts() {
  if (!isSupabaseEnabled() || !isLoggedIn()) {
    state.myWorkouts = [];
    renderMyWorkouts();
    return;
  }
  try {
    state.myWorkouts = await fetchUserWorkouts(state.session.user.id);
  } catch (error) {
    state.myWorkouts = [];
    showStatus(`Meine Workouts konnten nicht geladen werden: ${error.message}`, true);
  }
  renderMyWorkouts();
}

async function refreshCommunityWorkouts() {
  if (!isSupabaseEnabled()) {
    state.communityWorkouts = [];
    renderCommunityWorkouts();
    return;
  }
  try {
    state.communityWorkouts = await fetchCommunityWorkouts();
  } catch (error) {
    state.communityWorkouts = [];
    showStatus(`Community-Workouts konnten nicht geladen werden: ${error.message}`, true);
  }
  renderCommunityWorkouts();
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
    communityId: null,
    key: `custom-${uuid()}`,
    nameDe,
    nameEn,
    muscleGroups: muscleGroups.length ? muscleGroups : ["Ganzkörper"],
    equipmentType,
    difficultyLevel,
    descriptionDe,
    descriptionEn,
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
      showStatus(`Lokal gespeichert, Einreichung fehlgeschlagen: ${error.message}`, true);
      return;
    }
  }

  showStatus(`Lokal gespeichert: ${nameDe}. Ohne Login nur temporär im aktuellen Browser-Tab.`);
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

  el.workoutName.addEventListener("input", () => (state.workout.name = el.workoutName.value));
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
      const bundle = exportToGymboBundle(getBuilderPayload());
      downloadBundle(bundle, sanitizeFilename(state.workout.name));
      showStatus("Export erfolgreich. Öffne die Datei auf deinem iPhone mit GymBo.");
    } catch (error) {
      showStatus(error.message || "Export fehlgeschlagen.", true);
    }
  });

  el.saveWorkoutBtn.addEventListener("click", saveCurrentWorkout);
  el.deleteWorkoutBtn.addEventListener("click", deleteCurrentWorkout);
  el.submitWorkoutBtn.addEventListener("click", submitCurrentWorkoutToCommunity);

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
      await refreshMyWorkouts();
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
    if (event.target === el.customModal) closeCustomModal();
  });

  el.tabs.forEach((btn) => btn.addEventListener("click", () => updateMobileTabs(btn.dataset.tab)));

  onAuthStateChange(async () => {
    await refreshAuth();
    await refreshMyWorkouts();
    renderCatalog();
  });
}

async function init() {
  try {
    showStatus("Lade Übungskatalog...");
    const response = await fetch("data/exercise_catalog.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Katalog konnte nicht geladen werden.");

    const json = await response.json();
    state.builtInCatalog = (json.exercises || []).map(mapCatalogExercise);
    state.muscleGroups = json.muscleGroups || [];
    state.equipmentTypes = json.equipmentTypes || [];

    rebuildCatalog();
    renderFilters();

    if (isSupabaseEnabled()) {
      showStatus("Lade Community-Daten...");
      await refreshAuth();
      await Promise.all([
        refreshCommunityExercises(),
        refreshMyWorkouts(),
        refreshCommunityWorkouts()
      ]);
    } else {
      updateAuthUI();
      renderMyWorkouts();
      renderCommunityWorkouts();
    }

    renderCatalog();
    renderWorkout();
    bindEvents();
    showStatus("Katalog geladen. Wähle Übungen aus, sichere Workouts und exportiere Templates.");
  } catch (error) {
    showStatus(error.message || "Initialisierung fehlgeschlagen.", true);
  }
}

init();
