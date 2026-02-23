import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

export default function AdminSignUpPage() {
  const SUPER_ADMIN_EMAIL = "delaitremathis@gmail.com";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [admins, setAdmins] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingEmail, setEditingEmail] = useState("");

  const navigate = useNavigate();

  // 🔥 Live admin list
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "admins"), (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAdmins(list);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // 🔥 Ajouter dans Firestore
      await addDoc(collection(db, "admins"), {
        uid: userCredential.user.uid,
        email,
        createdAt: serverTimestamp(),
      });

      setSuccess("Compte admin créé avec succès !");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError("Erreur lors de la création du compte.");
      console.error(err);
    }
  };

  const handleDelete = async (id, adminEmail) => {
    if (adminEmail === SUPER_ADMIN_EMAIL) return;

    if (!window.confirm("Supprimer cet admin ?")) return;

    try {
      await deleteDoc(doc(db, "admins", id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (admin) => {
    setEditingId(admin.id);
    setEditingEmail(admin.email);
  };

  const handleUpdate = async (id) => {
    try {
      await updateDoc(doc(db, "admins", id), {
        email: editingEmail,
      });
      setEditingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: "600px" }}>
        <Link to="/admin">← Retour</Link>

        <h1 className="title mt-4 has-text-centered">
          Admin • Création de compte
        </h1>

        {/* FORMULAIRE */}
        <form onSubmit={handleSubmit} className="box">
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

          <button className="button is-primary is-fullwidth mt-4">
            Créer le compte
          </button>
        </form>

        {/* LISTE DES ADMINS */}
        <div className="box mt-5">
          <h2 className="title is-5">Liste des admins</h2>

          {admins.length === 0 ? (
            <p>Aucun admin trouvé.</p>
          ) : (
            <table className="table is-fullwidth">
              <thead>
                <tr>
                  <th>Email</th>
                  <th style={{ width: "200px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
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
                          {admin.email === SUPER_ADMIN_EMAIL && (
                            <span className="tag is-warning ml-2">
                              Super Admin
                            </span>
                          )}
                        </>
                      )}
                    </td>

                    <td>
                      {admin.email === SUPER_ADMIN_EMAIL ? (
                        <span className="has-text-grey">
                          Protégé
                        </span>
                      ) : editingId === admin.id ? (
                        <>
                          <button
                            className="button is-small is-success mr-2"
                            onClick={() => handleUpdate(admin.id)}
                          >
                            Sauvegarder
                          </button>
                          <button
                            className="button is-small"
                            onClick={() => setEditingId(null)}
                          >
                            Annuler
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="button is-small is-info mr-2"
                            onClick={() => handleEdit(admin)}
                          >
                            Modifier
                          </button>
                          <button
                            className="button is-small is-danger"
                            onClick={() =>
                              handleDelete(admin.id, admin.email)
                            }
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}