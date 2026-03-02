import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

function AutoFitTitle({ text }) {
  const boxRef = useRef(null);
  const [fontSize, setFontSize] = useState(14);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    // reset gros au début
    let size = 14;
    box.style.fontSize = `${size}px`;

    // baisse jusqu’à ce que ça rentre (max 12 essais)
    for (let i = 0; i < 12; i++) {
      const tooTall = box.scrollHeight > box.clientHeight;
      const tooWide = box.scrollWidth > box.clientWidth;

      if (!tooTall && !tooWide) break;

      size -= 1;
      if (size < 9) break; // limite mini lisible
      box.style.fontSize = `${size}px`;
    }

    setFontSize(size);
  }, [text]);

  return (
    <div className="coverFallbackTitleFit" ref={boxRef} style={{ fontSize }}>
      {text}
    </div>
  );
}

export default function BookCard({ book }) {
  const [imgOk, setImgOk] = useState(true);

  const isbnClean = useMemo(
    () => String(book?.isbn || "").replace(/[^0-9Xx]/g, "").toUpperCase(),
    [book?.isbn]
  );

  useEffect(() => setImgOk(true), [isbnClean]);

  const title = book?.title || "Sans titre";
  const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbnClean}-M.jpg?default=false`;

  return (
    <Link to={`/books/${isbnClean}`} className="cardLink">
      <div className="bookCard">
        <div className="cover">
          {imgOk && isbnClean ? (
            <img
              src={coverUrl}
              alt={title}
              onError={() => setImgOk(false)}
              loading="lazy"
            />
          ) : (
            <AutoFitTitle text={title} />
          )}
        </div>

        <div className="cardBody">
          <div className="statusRow">
            <span className={`pill ${book.status.tag}`}>{book.status.label}</span>
          </div>

          <div className="bookTitle" title={title}>
            {title}
          </div>

          <div className="meta">
            <span>{book.course}</span>
            <span>•</span>
            <span>ISBN {isbnClean}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}