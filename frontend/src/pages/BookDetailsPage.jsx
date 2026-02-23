import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../firebase/firebase.js";

function computeStatus(stock) {
  const n = Number(stock ?? 0);
  if (n <= 0) return { label: "Rupture", tag: "pill-danger", rank: 3 };
  if (n <= 2) return { label: "Stock faible", tag: "pill-warn", rank: 2 };
  return { label: "Dispo", tag: "pill-ok", rank: 1 };
}

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
  } catch {
    return `${n.toFixed(2)} $`;
  }
}

export default function BookDetailsPage() {
  const { isbn } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [book, setBook] = useState(null);
  const [imgOk, setImgOk] = useState(true);

  const coverUrl = useMemo(
    () => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
    [isbn]
  );

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");
      setBook(null);

      try {
        // ✅ Cas 1: ton docId = ISBN (le meilleur scénario)
        // -> on essaie d'abord une requête sur champ "isbn" (car tu m'as dit que parfois y'a juste "titre")
        // Si tu n'as pas de champ isbn dans les docs, on va fallback à chercher par doc.id en parcourant.
        const qRef = query(collection(db, "livres"), where("isbn", "==", isbn), limit(1));
        const snap = await getDocs(qRef);

        if (!alive) return;

        if (!snap.empty) {
          const d = snap.docs[0];
          const data = d.data();

          const titre = (data.titre ?? "").toString();
          const cours = (data.cours ?? data.course ?? "").toString();
          const stock = Number(data.stock ?? data.qte ?? data.quantite ?? 0);
          const prix = data.prix ?? data.price ?? null;

          setBook({
            id: d.id,
            isbn,
            title: titre || "(sans titre)",
            course: cours,
            stock: Number.isFinite(stock) ? stock : 0,
            price: prix,
          });
          setLoading(false);
          return;
        }

        // ✅ Fallback: si tu n'as PAS de champ "isbn" et que l'ISBN est le docId
        // On parcourt (ok pour petit dataset, plus tard on optimisera)
        const allSnap = await getDocs(collection(db, "livres"));
        if (!alive) return;

        const found = allSnap.docs.find((d) => d.id === isbn);
        if (!found) {
          setErr("Livre introuvable.");
          setLoading(false);
          return;
        }

        const data = found.data();
        const titre = (data.titre ?? "").toString();
        const cours = (data.cours ?? data.course ?? "").toString();
        const stock = Number(data.stock ?? data.qte ?? data.quantite ?? 0);
        const prix = data.prix ?? data.price ?? null;

        setBook({
          id: found.id,
          isbn,
          title: titre || "(sans titre)",
          course: cours,
          stock: Number.isFinite(stock) ? stock : 0,
          price: prix,
        });
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr("Erreur lors du chargement du livre depuis Firestore.");
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [isbn]);

  if (loading) {
    return (
      <div className="page">
        <header className="topbar">
          <div className="topbar-inner" style={{ maxWidth: 1100 }}>
            <Link to="/" className="adminBackLink">← Retour</Link>
          </div>
        </header>
        <main className="content">
          <div className="empty">Chargement…</div>
        </main>
      </div>
    );
  }

  if (err || !book) {
    return (
      <div className="page">
        <header className="topbar">
          <div className="topbar-inner" style={{ maxWidth: 1100 }}>
            <Link to="/" className="adminBackLink">← Retour</Link>
          </div>
        </header>
        <main className="content">
          <div className="empty">{err || "Livre introuvable."}</div>
        </main>
      </div>
    );
  }

  const status = computeStatus(book.stock);
  const priceLabel = money(book.price);

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner" style={{ maxWidth: 1100 }}>
          <Link to="/" className="adminBackLink">← Retour</Link>
        </div>
      </header>

      <main className="content">
        <div className="detailsWrap">
          <div className="detailsCard">
            <div className="detailsLeft">
              <div className="detailsCover">
                {imgOk ? (
                  <img src={coverUrl} alt={book.title} onError={() => setImgOk(false)} />
                ) : (
                  <div className="coverFallback"><span>AV</span></div>
                )}
              </div>
            </div>

            <div className="detailsRight">
              <div className="detailsTopRow">
                <span className={`pill ${status.tag}`}>{status.label}</span>
              </div>

              <h1 className="detailsTitle">{book.title}</h1>

              <div className="detailsMeta">
                <div className="detailsMetaRow">
                  <span className="detailsKey">Cours</span>
                  <span className="detailsVal">{book.course || "—"}</span>
                </div>

                <div className="detailsMetaRow">
                  <span className="detailsKey">ISBN</span>
                  <span className="detailsVal">{book.isbn}</span>
                </div>

                <div className="detailsMetaRow">
                  <span className="detailsKey">Stock</span>
                  <span className="detailsVal">{book.stock}</span>
                </div>

                <div className="detailsMetaRow">
                  <span className="detailsKey">Prix</span>
                  <span className="detailsVal">{priceLabel || "—"}</span>
                </div>
              </div>


            </div>
          </div>
        </div>
      </main>
    </div>
  );
}