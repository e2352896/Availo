const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const cors = require("cors");
const webpush = require("web-push");

const corsHandler = cors({ origin: true });

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

// ---- VAPID KEYS ----
// Tu vas les set avec firebase functions:config:set (plus bas)
function getVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID env variables");
  }

  return { publicKey, privateKey };
}

function safeSubIdFromEndpoint(endpoint) {
  // base64url simple
  return Buffer.from(String(endpoint)).toString("base64url").slice(0, 500);
}

function normalizeStock(data) {
  return Number(data?.stock ?? data?.qte ?? data?.quantite ?? 0) || 0;
}

// ✅ HTTP: subscribe
exports.subscribeBookAlert = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const { bookId, subscription } = req.body || {};
      if (!bookId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const subId = safeSubIdFromEndpoint(subscription.endpoint);
      const ref = db.collection("pushSubscriptions").doc(subId);

      await ref.set(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
          books: admin.firestore.FieldValue.arrayUnion(String(bookId)),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Server error" });
    }
  });
});

// ✅ HTTP: unsubscribe
exports.unsubscribeBookAlert = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const { bookId, subscription } = req.body || {};
      if (!bookId || !subscription?.endpoint) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const subId = safeSubIdFromEndpoint(subscription.endpoint);
      const ref = db.collection("pushSubscriptions").doc(subId);

      await ref.set(
        {
          books: admin.firestore.FieldValue.arrayRemove(String(bookId)),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Server error" });
    }
  });
});

// ✅ Trigger: si stock remonte au-dessus du seuil => push
const ALERT_THRESHOLD = 0; // change à 2 si tu veux "dispo" seulement au-dessus de 2

exports.onLivreStockUpdated = onDocumentUpdated(
  {
    document: "livres/{bookId}",
    region: "us-central1",
    secrets: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
  },
  async (event) => {
    try {
      const before = event.data.before.data();
      const after = event.data.after.data();

      const oldStock = normalizeStock(before);
      const newStock = normalizeStock(after);

      if (!(oldStock <= ALERT_THRESHOLD && newStock > ALERT_THRESHOLD)) return;

      const bookId = event.params.bookId;
      const titre = String(after?.titre ?? "(Livre)");

      const snap = await db
        .collection("pushSubscriptions")
        .where("books", "array-contains", String(bookId))
        .get();

      if (snap.empty) return;

      const { publicKey, privateKey } = getVapid();
      webpush.setVapidDetails("mailto:admin@availo.local", publicKey, privateKey);

      const payload = JSON.stringify({
        title: "Livre dispo ✅",
        body: `${titre} est de nouveau disponible (stock: ${newStock}).`,
        url: `/book/${bookId}`,
      });

      const sendPromises = snap.docs.map(async (d) => {
        const sub = d.data();
        const pushSub = { endpoint: sub.endpoint, keys: sub.keys };

        try {
          await webpush.sendNotification(pushSub, payload);
        } catch (err) {
          const code = err?.statusCode;
          if (code === 404 || code === 410) {
            await d.ref.delete();
          } else {
            console.error("Push send error:", err);
          }
        }
      });

      await Promise.allSettled(sendPromises);
    } catch (e) {
      console.error("onLivreStockUpdated error:", e);
    }
  }
);