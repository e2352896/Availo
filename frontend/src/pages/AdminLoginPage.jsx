import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebase";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/admin";
  const denied = Boolean(location.state?.denied);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate(redirectTo, { replace: true });
      }
    });

    return () => unsubscribe();
  }, [navigate, redirectTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);

      // ✅ Redirection vers /admin
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError("Email ou mot de passe invalide.");
      console.error(err);
    }
  };

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: "400px" }}>
        <Link to="/">← Retour</Link>

        <h1 className="title mt-4 has-text-centered">
          Admin • Connexion
        </h1>

        <form onSubmit={handleSubmit} className="box">
          {denied && !error && (
            <div className="notification is-warning">
              Acces refuse. Connecte-toi avec un compte admin.
            </div>
          )}

          {error && (
            <div className="notification is-danger">
              {error}
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

          <button className="button is-primary is-fullwidth mt-4">
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
