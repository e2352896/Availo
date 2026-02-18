import BookCard from "./BookCard.jsx";

export default function BookList({ books }) {
  if (!books.length) {
    return <div className="empty">Aucun résultat.</div>;
  }

  return (
    <div className="grid">
      {books.map((b) => (
        <BookCard key={b.isbn} book={b} />
      ))}
    </div>
  );
}
