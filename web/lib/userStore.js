import crypto from "node:crypto";
import { getSupabase } from "./supabase";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 uur

export async function listUsers() {
  const { data, error } = await getSupabase()
    .from("agency_users")
    .select("id, email, name, created_at, password_hash")
    .order("created_at");
  if (error) throw error;
  return data.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.created_at,
    passwordSet: !!u.password_hash,
  }));
}

export async function getUserByEmail(email) {
  const { data, error } = await getSupabase()
    .from("agency_users")
    .select("id, email, name, password_hash")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createUser({ email, name }) {
  const { data, error } = await getSupabase()
    .from("agency_users")
    .insert({ email: email.toLowerCase().trim(), name: name?.trim() || null })
    .select("id, email, name, created_at")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Dit e-mailadres bestaat al.");
    throw error;
  }
  return data;
}

export async function deleteUser(id) {
  const { error } = await getSupabase().from("agency_users").delete().eq("id", id);
  if (error) throw error;
}

export async function setPassword(userId, passwordHash) {
  const { error } = await getSupabase().from("agency_users").update({ password_hash: passwordHash }).eq("id", userId);
  if (error) throw error;
}

export async function createPasswordReset(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
  const { error } = await getSupabase().from("password_resets").insert({ token, user_id: userId, expires_at: expiresAt });
  if (error) throw error;
  return token;
}

export async function consumePasswordReset(token) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("password_resets")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  await supabase.from("password_resets").delete().eq("token", token);

  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.user_id;
}
