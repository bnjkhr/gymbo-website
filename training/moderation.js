import {
  isSupabaseEnabled,
  getSession,
  getCurrentProfile,
  fetchModerationQueue,
  fetchOpenReports,
  approveSubmission,
  rejectSubmission,
  updateReportStatus
} from "./supabase-client.js";

const el = {
  modAuthState: document.getElementById("modAuthState"),
  modStatus: document.getElementById("modStatus"),
  pendingCount: document.getElementById("pendingCount"),
  pendingList: document.getElementById("pendingList"),
  reportCount: document.getElementById("reportCount"),
  reportList: document.getElementById("reportList"),
  refreshBtn: document.getElementById("refreshBtn")
};

let session = null;
let profile = null;

function showStatus(message, isError = false) {
  el.modStatus.textContent = message;
  el.modStatus.style.color = isError ? "#fca5a5" : "#4ade80";
}

function isModerator() {
  return profile?.role === "moderator" || profile?.role === "admin";
}

function assertAllowed() {
  if (!isSupabaseEnabled()) {
    throw new Error("Supabase nicht konfiguriert.");
  }
  if (!session?.user?.id) {
    throw new Error("Nicht eingeloggt.");
  }
  if (!isModerator()) {
    throw new Error("Keine Moderationsrechte.");
  }
}

async function refreshData() {
  try {
    assertAllowed();

    const [pending, reports] = await Promise.all([
      fetchModerationQueue(),
      fetchOpenReports()
    ]);

    el.pendingCount.textContent = String(pending.length);
    el.reportCount.textContent = String(reports.length);

    el.pendingList.innerHTML = "";
    el.reportList.innerHTML = "";

    if (!pending.length) {
      const p = document.createElement("p");
      p.className = "catalog-meta";
      p.textContent = "Keine offenen Submissions.";
      el.pendingList.appendChild(p);
    }

    pending.forEach((row) => {
      const item = document.createElement("article");
      item.className = "catalog-item";
      item.innerHTML = `
        <h4>${row.name_de} / ${row.name_en}</h4>
        <div class="catalog-meta">${row.equipment_type} - ${row.difficulty} - ${row.muscle_groups.join(", ")}</div>
        <div class="vote-row">
          <button class="btn btn-primary" data-action="approve">Approve</button>
          <button class="btn btn-secondary" data-action="reject">Reject</button>
        </div>
      `;

      item.querySelector("[data-action='approve']").addEventListener("click", async () => {
        try {
          await approveSubmission(row.id);
          showStatus(`Approved: ${row.name_de}`);
          await refreshData();
        } catch (error) {
          showStatus(error.message || "Approve fehlgeschlagen.", true);
        }
      });

      item.querySelector("[data-action='reject']").addEventListener("click", async () => {
        const reason = prompt("Ablehnungsgrund (optional)", "");
        try {
          await rejectSubmission(row.id, reason || null);
          showStatus(`Rejected: ${row.name_de}`);
          await refreshData();
        } catch (error) {
          showStatus(error.message || "Reject fehlgeschlagen.", true);
        }
      });

      el.pendingList.appendChild(item);
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
        <h4>Exercise ${row.exercise_id}</h4>
        <div class="catalog-meta">Reason: ${row.reason}${row.details ? ` - ${row.details}` : ""}</div>
        <div class="vote-row">
          <button class="btn btn-primary" data-action="resolve">Resolve</button>
          <button class="btn btn-secondary" data-action="dismiss">Dismiss</button>
        </div>
      `;

      item.querySelector("[data-action='resolve']").addEventListener("click", async () => {
        try {
          await updateReportStatus(row.id, "resolved");
          showStatus(`Report resolved: ${row.id}`);
          await refreshData();
        } catch (error) {
          showStatus(error.message || "Resolve fehlgeschlagen.", true);
        }
      });

      item.querySelector("[data-action='dismiss']").addEventListener("click", async () => {
        try {
          await updateReportStatus(row.id, "dismissed");
          showStatus(`Report dismissed: ${row.id}`);
          await refreshData();
        } catch (error) {
          showStatus(error.message || "Dismiss fehlgeschlagen.", true);
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

el.refreshBtn.addEventListener("click", () => {
  refreshData();
});

init();
