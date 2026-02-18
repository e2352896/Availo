import { Link } from "react-router-dom";

export default function AdminLoginPage() {
  return (
    <div className="section">
      <div className="container">
        <Link to="/">← Retour</Link>
        <h1 className="title mt-4">Admin • Connexion</h1>
        <div className="notification is-light">
          (Prochaine étape) Connexion Firebase Auth.
        </div>
      </div>
    </div>
  );
}
