import { Link } from "react-router-dom";

export default function AdminPage() {
  return (
    <div className="section">
      <div className="container">
        <Link to="/">← Retour</Link>
        <h1 className="title mt-4">Admin • Import Excel</h1>
        <div className="notification is-light">
          (Prochaine étape) Upload Excel + import dans Firestore.
        </div>
      </div>
    </div>
  );
}
