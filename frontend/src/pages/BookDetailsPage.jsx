import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../firebase/firebase.js";

function AutoFitTitleCover({ text, className = "" }) {
  const boxRef = useRef(null);
  const [fontSize, setFontSize] = useState(18);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    let size = 18;
    box.style.fontSize = `${size}px`;

    for (let i = 0; i < 16; i++) {
      const tooTall = box.scrollHeight > box.clientHeight;
      const tooWide = box.scrollWidth > box.clientWidth;
      if (!tooTall && !tooWide) break;

      size -= 1;
      if (size < 10) break;
      box.style.fontSize = `${size}px`;
    }

    setFontSize(size);
  }, [text]);

  return (
    <div
      ref={boxRef}
      className={`detailsCoverFallback ${className}`}
      style={{ fontSize }}
    >
      {text || "Sans titre"}
    </div>
  );
}

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

  const isbnClean = useMemo(
    () => String(isbn || "").replace(/[^0-9Xx]/g, "").toUpperCase(),
    [isbn]
  );

  const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbnClean}-L.jpg?default=false`;
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => setImgOk(true), [isbnClean]);

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
          const editeur = (data.editeur ?? data.Editeur ?? data["Éditeur"] ?? "").toString();
          const stock = Number(data.stock ?? data.qte ?? data.quantite ?? 0);
          const prix = data.prix ?? data.price ?? null;

          setBook({
            id: d.id,
            isbn,
            title: titre || "(sans titre)",
            editeur,
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
        const editeur = (data.editeur ?? data.Editeur ?? data["Éditeur"] ?? "").toString();
        const stock = Number(data.stock ?? data.qte ?? data.quantite ?? 0);
        const prix = data.prix ?? data.price ?? null;

        setBook({
          id: found.id,
          isbn,
          title: titre || "(sans titre)",
          editeur,
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
                {imgOk && isbnClean ? (
                  <img
                    src={coverUrl}
                    alt={book?.title || "Couverture"}
                    onError={() => setImgOk(false)}
                    loading="lazy"
                  />
                ) : (
                  <AutoFitTitleCover text={book?.title} />
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
                  <span className="detailsKey">ISBN</span>
                  <span className="detailsVal">{book.isbn}</span>
                </div>

                <div className="detailsMetaRow">
                  <span className="detailsKey">Éditeur</span>
                  <span className="detailsVal">{book.editeur}</span>
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