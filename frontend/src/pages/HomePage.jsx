import { useEffect, useMemo, useState } from "react";
import SearchBar from "../components/SearchBar.jsx";
import BookList from "../components/BookList.jsx";

const PAGE_SIZE = 12;

const MOCK_BOOKS = [
  { isbn: "9780131103627", title: "C Programming Language", course: "420-6D1", stock: 3, price: 79.99 },
  { isbn: "9780132350884", title: "Clean Code", course: "420-PA1", stock: 0, price: 69.99 },
  { isbn: "9780262033848", title: "Introduction to Algorithms", course: "420-6D9", stock: 1, price: 99.99 },
  { isbn: "9781491950296", title: "Designing Data-Intensive Applications", course: "420-BD1", stock: 7, price: 89.99 },
  { isbn: "9780134685991", title: "Effective Java", course: "420-JV1", stock: 2, price: 84.99 },
  { isbn: "9780201633610", title: "Design Patterns", course: "420-OO1", stock: 4, price: 74.99 },
];

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
  const [sortKey, setSortKey] = useState("relevance"); // relevance | title_asc | stock_desc | availability
  const [page, setPage] = useState(1);

  const q = query.trim();
  const isSearching = q.length > 0;

  // reset page quand query/sort change
  useEffect(() => {
    setPage(1);
  }, [q, sortKey]);

  const filtered = useMemo(() => {
    if (!isSearching) return [];
    const nq = normalize(q);

    return MOCK_BOOKS
      .filter((b) => {
        const t = normalize(b.title);
        const i = normalize(b.isbn);
        const c = normalize(b.course);
        return t.includes(nq) || i.includes(nq) || c.includes(nq);
      })
      .map((b) => ({ ...b, status: computeStatus(b.stock) }));
  }, [q, isSearching]);

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
      // Dispo -> Stock faible -> Rupture, puis stock desc
      arr.sort((a, b) => (a.status.rank - b.status.rank) || ((b.stock ?? 0) - (a.stock ?? 0)));
      return arr;
    }

    // relevance (simple): match dans titre d'abord, puis stock desc
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

          <select
            className="sortSelect"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            aria-label="Trier"
          >
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
            </div>
          </section>
        ) : (
          <section className="results">
            <BookList
              books={paged}
              total={total}
              page={safePage}
              totalPages={totalPages}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              onGo={(p) => setPage(p)}
            />
          </section>
        )}
      </main>
    </div>
  );
}