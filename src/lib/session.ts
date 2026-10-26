import "server-only";
import { cookies } from "next/headers";
import { loadBase } from "./repo";

/**
 * DEMO ONLY: the "current user" is chosen with the switcher in the header and kept in a cookie.
 * This is NOT authentication. Replace with Google sign-in (Auth.js) before real employee data is used.
 * Only HR and the MD use the app; everyone else fills their scores in the Google Sheet.
 */
export const DEMO_COOKIE = "cb_demo_user";

export async function getCurrentUser() {
  const d = await loadBase();
  const id = (await cookies()).get(DEMO_COOKIE)?.value;
  const users = d.employees.filter((e) => e.active && (e.role === "hr" || e.role === "md"));
  const user = users.find((e) => e.employeeId === id) ?? users.find((e) => e.role === "hr") ?? users[0] ?? d.employees[0];
  if (!user) throw new Error("No employees found. Check the Employees tab in your Google Sheet.");
  return user;
}
