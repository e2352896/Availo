import { useEffect, useMemo, useState } from "react";
import SearchBar from "../components/SearchBar.jsx";
import BookList from "../components/BookList.jsx";

import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase.js";

const PAGE_SIZE = 12;

function computeStatus(stock) {
  if (stock <= 0) return { label: "Rupture", tag: "pill-danger", rank: 3 };
  if (stock <= 2) return { label: "Stock faible", tag: "pill-warn", rank: 2 };
  return { label: "Dispo", tag: "pill-ok", rank: 1 };
}

function normalize(str) {
  return (str || "").toString().toLowerCase().trim();
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("relevance");
  const [page, setPage] = useState(1);

  const [booksRaw, setBooksRaw] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [booksError, setBooksError] = useState("");

  const q = query.trim();
  const isSearching = q.length > 0;

  // ✅ Temps réel (tu ré-importes Excel → ça se met à jour direct)
  useEffect(() => {
    setLoadingBooks(true);
    setBooksError("");

    const unsub = onSnapshot(
      collection(db, "livres"),
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();

          // 🔥 Chez toi: titre (pas title)
          const titre = (data.titre ?? "").toString();

          // Si tu n'as pas isbn/code dans Firestore, on utilise l'id du doc comme identifiant
          const isbn = (data.isbn ?? data.ISBN ?? d.id ?? "").toString();

          const course = (data.cours ?? data.course ?? "").toString();
          const stock = Number(data.stock ?? data.qte ?? data.quantite ?? 0);
          const price = data.prix ?? data.price ?? null;

          return {
            id: d.id,
            isbn,
            title: titre,     // on normalise côté front pour garder le reste du code
            course,
            stock: Number.isFinite(stock) ? stock : 0,
            price,
          };
        });

        setBooksRaw(rows);
        setLoadingBooks(false);
      },
      (err) => {
        console.error(err);
        setBooksError("Impossible de charger les livres depuis Firestore.");
        setLoadingBooks(false);
      }
    );

    return () => unsub();
  }, []);

  // reset page quand query/sort change
  useEffect(() => {
    setPage(1);
  }, [q, sortKey]);

  const filtered = useMemo(() => {
    if (!isSearching) return [];
    const nq = normalize(q);

    return booksRaw
      .filter((b) => {
        const t = normalize(b.title);
        const i = normalize(b.isbn);
        const c = normalize(b.course);
        return t.includes(nq) || i.includes(nq) || c.includes(nq);
      })
      .map((b) => ({ ...b, status: computeStatus(b.stock) }));
  }, [q, isSearching, booksRaw]);

  const sorted = useMemo(() => {
    if (!isSearching) return [];
    const arr = [...filtered];

    if (sortKey === "title_asc") {
      arr.sort((a, b) => a.title.localeCompare(b.title));
      return arr;
    }

    if (sortKey === "stock_desc") {
      arr.sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
      return arr;
    }

    if (sortKey === "availability") {
      arr.sort((a, b) => a.status.rank - b.status.rank || (b.stock ?? 0) - (a.stock ?? 0));
      return arr;
    }

    const nq = normalize(q);
    arr.sort((a, b) => {
      const aInTitle = normalize(a.title).includes(nq) ? 1 : 0;
      const bInTitle = normalize(b.title).includes(nq) ? 1 : 0;
      if (bInTitle !== aInTitle) return bInTitle - aInTitle;
      return (b.stock ?? 0) - (a.stock ?? 0);
    });

    return arr;
  }, [filtered, sortKey, q, isSearching]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(() => {
    if (!isSearching) return [];
    const start = (safePage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, safePage, isSearching]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner topbar-row">
          <SearchBar value={query} onChange={setQuery} />
          <select className="sortSelect" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="relevance">Tri : Pertinence</option>
            <option value="availability">Tri : Disponibilité</option>
            <option value="title_asc">Tri : Titre (A → Z)</option>
            <option value="stock_desc">Tri : Stock (↓)</option>
          </select>
        </div>
      </header>

      <main className="content">
        {!isSearching ? (
          <section className="hero">
            <div className="hero-inner">
              <h1 className="hero-title">Availo</h1>
              <p className="hero-subtitle">Vérifiez la disponibilité des livres de la COOP</p>

              {loadingBooks && <p className="hero-subtitle" style={{ marginTop: 12 }}>Chargement de l’inventaire…</p>}
              {booksError && <p className="hero-subtitle" style={{ marginTop: 12 }}>{booksError}</p>}
            </div>
          </section>
        ) : (
          <section className="results">
            {loadingBooks ? (
              <div className="empty">Chargement…</div>
            ) : booksError ? (
              <div className="empty">{booksError}</div>
            ) : (
              <BookList
                books={paged}
                total={total}
                page={safePage}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                onGo={(p) => setPage(p)}
              />
            )}
          </section>
        )}
      </main>
    </div>
  );
}