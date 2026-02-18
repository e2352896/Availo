import { Link } from "react-router-dom";
import { useState } from "react";

export default function BookCard({ book }) {
  const [imgOk, setImgOk] = useState(true);

  // Option simple: cover via OpenLibrary (si dispo). Sinon fallback.
  const coverUrl = `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`;

  return (
    <Link to={`/books/${book.isbn}`} className="cardLink">
      <div className="bookCard">
        <div className="cover">
          {imgOk ? (
            <img
              src={coverUrl}
              alt={book.title}
              onError={() => setImgOk(false)}
              loading="lazy"
            />
          ) : (
            <div className="coverFallback">
              <span>AV</span>
            </div>
          )}
        </div>

        <div className="cardBody">
          <div className="titleRow">
            <div className="bookTitle" title={book.title}>{book.title}</div>
            <span className={`pill ${book.status.tag}`}>{book.status.label}</span>
          </div>

          <div className="meta">
            <span>{book.course}</span>
            <span>•</span>
            <span>ISBN {book.isbn}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
