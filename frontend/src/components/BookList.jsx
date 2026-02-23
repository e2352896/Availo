import BookCard from "./BookCard.jsx";

function getPageNumbers(current, total) {
  const pages = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(total, current + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

export default function BookList({ books, total, page, totalPages, onPrev, onNext, onGo }) {
  if (!books.length) {
    return <div className="empty">Aucun résultat.</div>;
  }

  const pages = getPageNumbers(page, totalPages);

  return (
    <>
      <div className="resultsHeader">
        <div className="resultsCount">{total} résultat{total > 1 ? "s" : ""}</div>
        <div className="resultsPage">Page {page} / {totalPages}</div>
      </div>

      <div className="grid">
        {books.map((b) => (
          <BookCard key={b.isbn} book={b} />
        ))}
      </div>

      <div className="pager">
        <button className="pagerBtn" onClick={onPrev} disabled={page <= 1}>
          ← Précédent
        </button>

        <div className="pagerNums">
          {page > 3 && (
            <>
              <button className="pagerNum" onClick={() => onGo(1)}>1</button>
              <span className="pagerDots">…</span>
            </>
          )}

          {pages.map((p) => (
            <button
              key={p}
              className={`pagerNum ${p === page ? "isActive" : ""}`}
              onClick={() => onGo(p)}
            >
              {p}
            </button>
          ))}

          {page < totalPages - 2 && (
            <>
              <span className="pagerDots">…</span>
              <button className="pagerNum" onClick={() => onGo(totalPages)}>{totalPages}</button>
            </>
          )}
        </div>

        <button className="pagerBtn" onClick={onNext} disabled={page >= totalPages}>
          Suivant →
        </button>
      </div>
    </>
  );
}