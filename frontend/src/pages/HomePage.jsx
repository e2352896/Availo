import { useMemo, useState } from "react";
import SearchBar from "../components/SearchBar.jsx";
import BookList from "../components/BookList.jsx";

const MOCK_BOOKS = [
  { isbn: "9780131103627", title: "C Programming Language", course: "420-6D1", stock: 3, price: 79.99 },
  { isbn: "9780132350884", title: "Clean Code", course: "420-PA1", stock: 0, price: 69.99 },
  { isbn: "9780262033848", title: "Introduction to Algorithms", course: "420-6D9", stock: 1, price: 99.99 },
  { isbn: "9781491950296", title: "Designing Data-Intensive Applications", course: "420-BD1", stock: 7, price: 89.99 },
  { isbn: "9780134685991", title: "Effective Java", course: "420-JV1", stock: 2, price: 84.99 },
  { isbn: "9780201633610", title: "Design Patterns", course: "420-OO1", stock: 4, price: 74.99 },
];

function computeStatus(stock) {
  if (stock <= 0) return { label: "Rupture", tag: "pill-danger" };
  if (stock <= 2) return { label: "Stock faible", tag: "pill-warn" };
  return { label: "Dispo", tag: "pill-ok" };
}

export default function HomePage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return MOCK_BOOKS
      .filter((b) => (
        b.title.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.course.toLowerCase().includes(q)
      ))
      .map((b) => ({ ...b, status: computeStatus(b.stock) }));
  }, [query]);

  const isSearching = query.trim().length > 0;

  return (
    <div className="page">
      {/* Top centered search */}
      <header className="topbar">
        <div className="topbar-inner">
          <SearchBar value={query} onChange={setQuery} />
        </div>
      </header>

      {/* Content */}
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
            <BookList books={filtered} />
          </section>
        )}
      </main>
    </div>
  );
}
