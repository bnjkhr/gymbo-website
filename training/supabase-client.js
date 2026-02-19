import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.SUPABASE_CONFIG || {};
const hasConfig = Boolean(cfg.url && cfg.anonKey);
const supabase = hasConfig ? createClient(cfg.url, cfg.anonKey) : null;

export function isSupabaseEnabled() {
  return Boolean(supabase);
}

export function getSupabaseClient() {
  return supabase;
}

export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signInWithOtp(email) {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
  const redirectTo = cfg.redirectTo || window.location.origin + "/training/";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentProfile() {
  if (!supabase) return null;
  const session = await getSession();
  if (!session?.user?.id) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCommunityExercises() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_exercises")
    .select("id,name_de,name_en,description_de,description_en,instructions_de,instructions_en,muscle_groups,equipment_type,difficulty,score,reports_count")
    .eq("is_active", true)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function submitExerciseSubmission(payload, userId) {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
  const { error } = await supabase.from("community_exercise_submissions").insert({
    created_by: userId,
    status: "pending",
    ...payload
  });
  if (error) throw error;
}

export async function upsertVote(exerciseId, userId, vote) {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
  const { error } = await supabase.from("community_exercise_votes").upsert(
    {
      exercise_id: exerciseId,
      user_id: userId,
      vote
    },
    { onConflict: "exercise_id,user_id" }
  );
  if (error) throw error;
}

export async function reportExercise(exerciseId, userId, reason, details) {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
  const { error } = await supabase.from("community_exercise_reports").upsert(
    {
      exercise_id: exerciseId,
      user_id: userId,
      reason,
      details: details || null,
      status: "open"
    },
    { onConflict: "exercise_id,user_id" }
  );
  if (error) throw error;
}

export async function fetchModerationQueue() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_exercise_submissions")
    .select("id,created_at,name_de,name_en,equipment_type,difficulty,muscle_groups,status")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function approveSubmission(submissionId) {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
  const { error } = await supabase.rpc("approve_submission", { submission_id: submissionId });
  if (error) throw error;
}

export async function rejectSubmission(submissionId, reason = null) {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
  const { error } = await supabase.rpc("reject_submission", {
    submission_id: submissionId,
    reason
  });
  if (error) throw error;
}

export async function fetchOpenReports() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_exercise_reports")
    .select("id,exercise_id,user_id,reason,details,status,created_at")
    .in("status", ["open", "reviewing"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateReportStatus(reportId, status) {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
  const { error } = await supabase
    .from("community_exercise_reports")
    .update({ status })
    .eq("id", reportId);
  if (error) throw error;
}
