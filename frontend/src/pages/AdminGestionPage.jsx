import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import {
  createAdminAccount,
  deleteAdminAccount,
  updateAdminAccount,
} from "../services/adminAccounts";

export default function AdminGestionPage() {
  const SUPER_ADMIN_EMAIL = "delaitremathis@gmail.com";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [admins, setAdmins] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingEmail, setEditingEmail] = useState("");
  const [editingRole, setEditingRole] = useState("admin");
  const [busyAction, setBusyAction] = useState("");
  const [currentUid, setCurrentUid] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid || "");
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "admins"), (snapshot) => {
      const list = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      setAdmins(list);
    });

    return () => unsubscribe();
  }, []);

  const currentAdmin = admins.find((admin) => admin.uid === currentUid);
  const isCurrentSuperAdmin =
    currentAdmin?.role === "super_admin" || currentAdmin?.email === SUPER_ADMIN_EMAIL;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/admin/login", { replace: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      setBusyAction("create");
      await createAdminAccount({ email, password });
      setSuccess("Compte admin cree avec succes.");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message = err?.message || "Erreur lors de la creation du compte.";
      setError(message);
      console.error(err);
    } finally {
      setBusyAction("");
    }
  };

  const handleDelete = async (admin) => {
    if (admin.email === SUPER_ADMIN_EMAIL) return;
    if (!window.confirm("Supprimer cet admin ?")) return;

    try {
      setError("");
      setSuccess("");
      setBusyAction(`delete-${admin.id}`);
      await deleteAdminAccount({ uid: admin.uid, email: admin.email });
      setSuccess("Compte admin supprime.");
      if (admin.uid === currentUid) {
        await signOut(auth);
        navigate("/admin/login", { replace: true });
      }
    } catch (err) {
      const message = err?.message || "Erreur lors de la suppression.";
      setError(message);
      console.error(err);
    } finally {
      setBusyAction("");
    }
  };

  const handleEdit = (admin) => {
    setEditingId(admin.id);
    setEditingEmail(admin.email);
    setEditingRole(admin.role || "admin");
    setError("");
    setSuccess("");
  };

  const handleUpdate = async (admin) => {
    try {
      setBusyAction(`update-${admin.id}`);
      await updateAdminAccount({
        uid: admin.uid,
        currentEmail: admin.email,
        newEmail: editingEmail,
        ...(isCurrentSuperAdmin ? { newRole: editingRole } : {}),
      });
      setEditingId(null);
      setSuccess("Email admin modifie.");
    } catch (err) {
      const message = err?.message || "Erreur lors de la modification.";
      setError(message);
      console.error(err);
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="page">
      <header className="topbar">
        <div
          className="topbar-inner"
          style={{ justifyContent: "space-between", maxWidth: 1100 }}
        >
          <Link to="/admin" className="adminBackLink">
            Retour
          </Link>

          <div className="adminTitleWrap">
            <div className="adminTitle">Admin</div>
            <div className="adminSubtitle">Gestion des comptes</div>
          </div>

          <button type="button" className="adminPill" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="content">
        <section className="dashHeader">
          <div>
            <h1 className="dashH1">Création de compte admin</h1>
            <p className="dashP">Ajoute, modifie ou supprime les comptes admin.</p>
          </div>
        </section>

        <div className="dashPanel" style={{ marginBottom: 12 }}>
          <div className="dashPanelTitle">Nouveau compte admin</div>
          <div className="dashPanelBody">
            <form onSubmit={handleSubmit}>
              {error && <div className="notification is-danger">{error}</div>}
              {success && <div className="notification is-success">{success}</div>}

              <div className="field">
                <label className="label">Email</label>
                <div className="control">
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">Mot de passe</label>
                <div className="control">
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">Confirmer le mot de passe</label>
                <div className="control">
                  <input
                    className="input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                className="actionBtn"
                type="submit"
                disabled={busyAction === "create"}
              >
                {busyAction === "create" ? "Creation..." : "Créer le compte"}
              </button>
            </form>
          </div>
        </div>

        <div className="dashPanel">
          <div className="dashPanelTitle">Liste des admins</div>
          <div className="dashPanelBody">
            {admins.length === 0 ? (
              <div className="empty">Aucun admin trouve.</div>
            ) : (
              <div className="tableWrap">
                <table className="miniTable">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th style={{ width: "150px" }}>Role</th>
                      <th style={{ width: "260px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => {
                      const isSuperAdmin =
                        admin.role === "super_admin" || admin.email === SUPER_ADMIN_EMAIL;
                      const canManage = isCurrentSuperAdmin || admin.uid === currentUid;
                      const isUpdating = busyAction === `update-${admin.id}`;
                      const isDeleting = busyAction === `delete-${admin.id}`;

                      return (
                        <tr key={admin.id}>
                          <td>
                            {editingId === admin.id ? (
                              <input
                                className="input"
                                value={editingEmail}
                                onChange={(e) => setEditingEmail(e.target.value)}
                              />
                          ) : (
                            <>
                              {admin.email}
                              {isSuperAdmin && (
                                <span className="tag is-warning ml-2">Super Admin</span>
                              )}
                            </>
                          )}
                        </td>

                        <td>
                          {editingId === admin.id && isCurrentSuperAdmin ? (
                            <div className="select is-small">
                              <select
                                value={editingRole}
                                onChange={(e) => setEditingRole(e.target.value)}
                                disabled={isUpdating}
                              >
                                <option value="admin">admin</option>
                                <option value="super_admin">super_admin</option>
                              </select>
                            </div>
                          ) : (
                            <span>{admin.role || (isSuperAdmin ? "super_admin" : "admin")}</span>
                          )}
                        </td>

                        <td>
                          {isSuperAdmin && !isCurrentSuperAdmin ? (
                            <span className="has-text-grey">Protegé</span>
                          ) : !canManage ? (
                            <span className="has-text-grey">Non autorisé</span>
                          ) : editingId === admin.id ? (
                            <>
                              <button
                                className="button is-small is-success mr-2"
                                type="button"
                                  onClick={() => handleUpdate(admin)}
                                  disabled={isUpdating}
                                >
                                  {isUpdating ? "Sauvegarde..." : "Sauvegarder"}
                                </button>
                                <button
                                  className="button is-small"
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  disabled={isUpdating}
                                >
                                  Annuler
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                className="button is-small is-info mr-2"
                                type="button"
                                onClick={() => handleEdit(admin)}
                                disabled={isDeleting}
                              >
                                Modifier
                              </button>
                              <button
                                className="button is-small is-danger"
                                type="button"
                                onClick={() => handleDelete(admin)}
                                disabled={isDeleting}
                              >
                                  {isDeleting ? "Suppression..." : admin.uid === currentUid ? "Supprimer mon compte" : "Supprimer"}
                              </button>
                            </>
                          )}
                        </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
