const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const SUPER_ADMIN_EMAIL = "delaitremathis@gmail.com";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function ensureCallerIsAdmin(request) {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Authentification requise.");
  }

  const snap = await db
    .collection("admins")
    .where("uid", "==", callerUid)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError("permission-denied", "Acces admin requis.");
  }

  const adminDoc = snap.docs[0].data() || {};
  const callerEmail = normalizeEmail(adminDoc.email);
  const callerRole = String(adminDoc.role || "admin");
  const isSuperAdmin =
    callerRole === "super_admin" || callerEmail === SUPER_ADMIN_EMAIL;

  return {
    uid: callerUid,
    email: callerEmail,
    role: callerRole,
    isSuperAdmin,
  };
}

async function upsertAdminDoc(uid, email, role = "admin") {
  const adminEmail = normalizeEmail(email);
  const adminRef = db.collection("admins").doc(uid);
  await adminRef.set(
    {
      uid,
      email: adminEmail,
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function deleteAdminDocsByUid(uid) {
  const snap = await db.collection("admins").where("uid", "==", uid).get();
  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function getAdminRoleByUid(uid) {
  const snap = await db.collection("admins").where("uid", "==", uid).limit(1).get();
  if (snap.empty) return "admin";
  return String(snap.docs[0].data()?.role || "admin");
}

function mapAuthError(error, defaultMessage) {
  const code = error?.code || "";
  if (code.includes("email-already-exists")) {
    return new HttpsError("already-exists", "Cet email existe deja.");
  }
  if (code.includes("invalid-email")) {
    return new HttpsError("invalid-argument", "Email invalide.");
  }
  if (code.includes("invalid-password")) {
    return new HttpsError("invalid-argument", "Mot de passe invalide.");
  }
  if (code.includes("user-not-found")) {
    return new HttpsError("not-found", "Compte introuvable.");
  }
  return new HttpsError("internal", defaultMessage);
}

exports.createAdminAccount = onCall(async (request) => {
  await ensureCallerIsAdmin(request);

  const email = normalizeEmail(request.data?.email);
  const password = String(request.data?.password || "");

  if (!email) {
    throw new HttpsError("invalid-argument", "Email requis.");
  }
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Mot de passe minimum: 6 caracteres.");
  }

  try {
    const user = await auth.createUser({
      email,
      password,
      disabled: false,
    });

    await auth.setCustomUserClaims(user.uid, { admin: true, superAdmin: false });
    await upsertAdminDoc(user.uid, email, "admin");

    return { ok: true, uid: user.uid, email };
  } catch (error) {
    throw mapAuthError(error, "Echec de creation du compte.");
  }
});

exports.updateAdminAccount = onCall(async (request) => {
  const caller = await ensureCallerIsAdmin(request);

  const uid = String(request.data?.uid || "").trim();
  const newEmail = normalizeEmail(request.data?.newEmail);
  const newRoleRaw = request.data?.newRole;
  const hasRoleUpdate = newRoleRaw != null && newRoleRaw !== "";
  const newRole = hasRoleUpdate ? String(newRoleRaw) : null;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID requis.");
  }
  if (!newEmail) {
    throw new HttpsError("invalid-argument", "Nouvel email requis.");
  }
  if (!caller.isSuperAdmin && caller.uid !== uid) {
    throw new HttpsError(
      "permission-denied",
      "Tu peux modifier seulement ton propre compte."
    );
  }
  if (hasRoleUpdate && !caller.isSuperAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Seul un super admin peut changer le role."
    );
  }
  if (hasRoleUpdate && newRole !== "admin" && newRole !== "super_admin") {
    throw new HttpsError("invalid-argument", "Role invalide.");
  }

  try {
    const user = await auth.getUser(uid);
    const currentEmail = normalizeEmail(user.email);
    const currentRole = await getAdminRoleByUid(uid);

    if (currentEmail === SUPER_ADMIN_EMAIL && newEmail !== SUPER_ADMIN_EMAIL) {
      throw new HttpsError("permission-denied", "Le super admin ne peut pas etre modifie.");
    }

    await auth.updateUser(uid, { email: newEmail });
    const finalRole =
      newEmail === SUPER_ADMIN_EMAIL
        ? "super_admin"
        : hasRoleUpdate
          ? newRole
          : currentRole;

    const claims = { admin: true, superAdmin: finalRole === "super_admin" };
    await auth.setCustomUserClaims(uid, claims);
    await upsertAdminDoc(uid, newEmail, finalRole);

    return { ok: true, uid, email: newEmail, role: finalRole };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw mapAuthError(error, "Echec de modification du compte.");
  }
});

exports.deleteAdminAccount = onCall(async (request) => {
  const caller = await ensureCallerIsAdmin(request);
  const uid = String(request.data?.uid || "").trim();

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID requis.");
  }
  if (!caller.isSuperAdmin && caller.uid !== uid) {
    throw new HttpsError(
      "permission-denied",
      "Tu peux supprimer seulement ton propre compte."
    );
  }

  try {
    const user = await auth.getUser(uid);
    const targetEmail = normalizeEmail(user.email);

    if (targetEmail === SUPER_ADMIN_EMAIL) {
      throw new HttpsError("permission-denied", "Le super admin ne peut pas etre supprime.");
    }

    await auth.deleteUser(uid);
    await deleteAdminDocsByUid(uid);

    return { ok: true, uid };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw mapAuthError(error, "Echec de suppression du compte.");
  }
});
