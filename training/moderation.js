import {
  isSupabaseEnabled,
  getSession,
  getCurrentProfile,
  fetchModerationQueue,
  fetchWorkoutModerationQueue,
  fetchOpenReports,
  approveSubmission,
  rejectSubmission,
  approveWorkoutSubmission,
  rejectWorkoutSubmission,
  updateReportStatus
} from "./supabase-client.js";

const el = {
  modAuthState: document.getElementById("modAuthState"),
  modStatus: document.getElementById("modStatus"),
  pendingCount: document.getElementById("pendingCount"),
  pendingList: document.getElementById("pendingList"),
  reportCount: document.getElementById("reportCount"),
  reportList: document.getElementById("reportList"),
  workoutPendingCount: document.getElementById("workoutPendingCount"),
  workoutPendingList: document.getElementById("workoutPendingList"),
  refreshBtn: document.getElementById("refreshBtn")
};

let session = null;
let profile = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showPromptModal(title, placeholder) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modPromptModal");
    const titleEl = modal.querySelector(".prompt-title");
    const input = modal.querySelector(".prompt-input");
    const confirmBtn = modal.querySelector("[data-action='confirm']");
    const cancelBtn = modal.querySelector("[data-action='cancel']");

    titleEl.textContent = title;
    input.value = "";
    input.placeholder = placeholder || "";

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
      resolve({ confirmed: true, text: input.value });
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
  el.modStatus.textContent = message;
  el.modStatus.style.color = isError ? "#fca5a5" : "#4ade80";
}

function isModerator() {
  return profile?.role === "moderator" || profile?.role === "admin";
}

function assertAllowed() {
  if (!isSupabaseEnabled()) throw new Error("Supabase nicht konfiguriert.");
  if (!session?.user?.id) throw new Error("Nicht eingeloggt.");
  if (!isModerator()) throw new Error("Keine Moderationsrechte.");
}

async function refreshData() {
  try {
    assertAllowed();

    const [pendingExercises, reports, pendingWorkouts] = await Promise.all([
      fetchModerationQueue(),
      fetchOpenReports(),
      fetchWorkoutModerationQueue()
    ]);

    el.pendingCount.textContent = String(pendingExercises.length);
    el.reportCount.textContent = String(reports.length);
    el.workoutPendingCount.textContent = String(pendingWorkouts.length);

    el.pendingList.innerHTML = "";
    el.reportList.innerHTML = "";
    el.workoutPendingList.innerHTML = "";

    if (!pendingExercises.length) {
      const p = document.createElement("p");
      p.className = "catalog-meta";
      p.textContent = "Keine offenen Übungs-Submissions.";
      el.pendingList.appendChild(p);
    }

    pendingExercises.forEach((row) => {
      const item = document.createElement("article");
      item.className = "catalog-item";
      item.innerHTML = `
        <h4>${escapeHtml(row.name_de)} / ${escapeHtml(row.name_en)}</h4>
        <div class="catalog-meta">${escapeHtml(row.equipment_type)} · ${escapeHtml(row.difficulty)} · ${escapeHtml(row.muscle_groups.join(", "))}</div>
        <div class="vote-row">
          <button class="btn btn-primary" data-action="approve">Freigeben</button>
          <button class="btn btn-secondary" data-action="reject">Ablehnen</button>
        </div>
      `;

      item.querySelector("[data-action='approve']").addEventListener("click", async () => {
        try {
          await approveSubmission(row.id);
          showStatus(`Übung freigegeben: ${row.name_de}`);
          await refreshData();
        } catch (error) {
          showStatus(error.message || "Freigabe fehlgeschlagen.", true);
        }
      });

      item.querySelector("[data-action='reject']").addEventListener("click", async () => {
        const result = await showPromptModal("Ablehnungsgrund", "Grund (optional)");
        if (!result.confirmed) return;
        try {
          await rejectSubmission(row.id, result.text || null);
          showStatus(`Übung abgelehnt: ${row.name_de}`);
          await refreshData();
        } catch (error) {
          showStatus(error.message || "Ablehnung fehlgeschlagen.", true);
        }
      });

      el.pendingList.appendChild(item);
    });

    if (!pendingWorkouts.length) {
      const p = document.createElement("p");
      p.className = "catalog-meta";
      p.textContent = "Keine offenen Workout-Submissions.";
      el.workoutPendingList.appendChild(p);
    }

    pendingWorkouts.forEach((row) => {
      const item = document.createElement("article");
      item.className = "catalog-item";
      item.innerHTML = `
        <h4>${escapeHtml(row.name)}</h4>
        <div class="catalog-meta">${escapeHtml(row.workout_type)} · ${new Date(row.created_at).toLocaleString("de-DE")}</div>
        <div class="vote-row">
          <button class="btn btn-primary" data-action="approve">Freigeben</button>
          <button class="btn btn-secondary" data-action="reject">Ablehnen</button>
        </div>
      `;

      item.querySelector("[data-action='approve']").addEventListener("click", async () => {
        try {
          await approveWorkoutSubmission(row.id);
          showStatus(`Workout freigegeben: ${row.name}`);
          await refreshData();
        } catch (error) {
          showStatus(error.message || "Freigabe fehlgeschlagen.", true);
        }
      });

      item.querySelector("[data-action='reject']").addEventListener("click", async () => {
        const result = await showPromptModal("Ablehnungsgrund", "Grund (optional)");
        if (!result.confirmed) return;
        try {
          await rejectWorkoutSubmission(row.id, result.text || null);
          showStatus(`Workout abgelehnt: ${row.name}`);
          await refreshData();
        } catch (error) {
          showStatus(error.message || "Ablehnung fehlgeschlagen.", true);
        }
      });

      el.workoutPendingList.appendChild(item);
    });

    if (!reports.length) {
      const p = document.createElement("p");
      p.className = "catalog-meta";
      p.textContent = "Keine offenen Reports.";
      el.reportList.appendChild(p);
    }

    reports.forEach((row) => {
      const item = document.createElement("article");
      item.className = "catalog-item";
      item.innerHTML = `
        <h4>Exercise ${escapeHtml(String(row.exercise_id))}</h4>
        <div class="catalog-meta">Grund: ${escapeHtml(row.reason)}${row.details ? ` · ${escapeHtml(row.details)}` : ""}</div>
        <div class="vote-row">
          <button class="btn btn-primary" data-action="resolve">Erledigt</button>
          <button class="btn btn-secondary" data-action="dismiss">Verwerfen</button>
        </div>
      `;

      item.querySelector("[data-action='resolve']").addEventListener("click", async () => {
        try {
          await updateReportStatus(row.id, "resolved");
          showStatus(`Report erledigt: ${row.id}`);
          await refreshData();
        } catch (error) {
          showStatus(error.message || "Statusupdate fehlgeschlagen.", true);
        }
      });

      item.querySelector("[data-action='dismiss']").addEventListener("click", async () => {
        try {
          await updateReportStatus(row.id, "dismissed");
          showStatus(`Report verworfen: ${row.id}`);
          await refreshData();
        } catch (error) {
          showStatus(error.message || "Statusupdate fehlgeschlagen.", true);
        }
      });

      el.reportList.appendChild(item);
    });
  } catch (error) {
    showStatus(error.message || "Moderation konnte nicht geladen werden.", true);
  }
}

async function init() {
  try {
    if (!isSupabaseEnabled()) {
      el.modAuthState.textContent = "Supabase nicht konfiguriert.";
      return;
    }

    session = await getSession();
    profile = await getCurrentProfile();

    if (!session?.user?.id) {
      el.modAuthState.textContent = "Bitte zuerst auf /training einloggen.";
      return;
    }

    if (!isModerator()) {
      el.modAuthState.textContent = "Kein Zugriff: Moderator- oder Admin-Rolle erforderlich.";
      return;
    }

    el.modAuthState.textContent = `Eingeloggt als ${session.user.email} (${profile.role}).`;
    await refreshData();
  } catch (error) {
    showStatus(error.message || "Initialisierung fehlgeschlagen.", true);
  }
}

el.refreshBtn.addEventListener("click", refreshData);

init();
