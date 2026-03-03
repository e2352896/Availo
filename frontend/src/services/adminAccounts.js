import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebase";

const createAdminAccountFn = httpsCallable(functions, "createAdminAccount");
const updateAdminAccountFn = httpsCallable(functions, "updateAdminAccount");
const deleteAdminAccountFn = httpsCallable(functions, "deleteAdminAccount");

export async function createAdminAccount(payload) {
  const result = await createAdminAccountFn(payload);
  return result.data;
}

export async function updateAdminAccount(payload) {
  const result = await updateAdminAccountFn(payload);
  return result.data;
}

export async function deleteAdminAccount(payload) {
  const result = await deleteAdminAccountFn(payload);
  return result.data;
}
