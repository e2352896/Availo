export default function SearchBar({ value, onChange }) {
  return (
    <div className="search-wrap">
      <input
        className="search-input"
        type="text"
        placeholder="Rechercher un livre, ISBN, cours…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}
