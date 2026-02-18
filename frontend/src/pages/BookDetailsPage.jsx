import { useParams, Link } from "react-router-dom";

export default function BookDetailsPage() {
  const { isbn } = useParams();

  return (
    <div className="section">
      <div className="container">
        <Link to="/">← Retour</Link>
        <h1 className="title mt-4">Détails du livre</h1>
        <p className="subtitle">ISBN : {isbn}</p>

        <div className="notification is-light">
          (Prochaine étape) Ici on affichera le livre depuis Firestore.
        </div>
      </div>
    </div>
  );
}
