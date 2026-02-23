import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebase";

export default function AdminSignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Vérification que les mots de passe correspondent
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);

      // Message de succès ou redirection
      setSuccess("Compte admin créé avec succès !");
      // ✅ Redirection vers /admin si tu veux connecter directement
      navigate("/admin");
    } catch (err) {
      setError("Erreur lors de la création du compte. Vérifiez vos informations.");
      console.error(err);
    }
  };

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: "400px" }}>
        <Link to="/">← Retour</Link>

        <h1 className="title mt-4 has-text-centered">
          Admin • Création de compte
        </h1>

        <form onSubmit={handleSubmit} className="box">
          {error && (
            <div className="notification is-danger">
              {error}
            </div>
          )}
          {success && (
            <div className="notification is-success">
              {success}
            </div>
          )}

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
      </div>
    </div>
  );
}