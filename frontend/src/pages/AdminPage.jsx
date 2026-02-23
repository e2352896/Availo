import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

function computeStatus(stock) {
  const n = Number(stock);
  if (!Number.isFinite(n)) return "unknown";
  if (n <= 0) return "rupture";
  if (n <= 2) return "low";
  return "ok";
}

function pickColumn(row, candidates) {
  const keys = Object.keys(row || {});
  for (const c of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase() === c);
    if (found) return row[found];
  }
  return undefined;
}

function normalizeBooks(rows) {
  const out = [];
  for (const r of rows) {
    const isbn = String(
      pickColumn(r, ["isbn", "codeisbn", "isbn13", "ean", "barcode"]) ?? ""
    ).trim();

    const title = String(
      pickColumn(r, ["title", "titre", "nom", "produit", "description"]) ?? ""
    ).trim();

    const course = String(
      pickColumn(r, ["course", "cours", "code cours", "code_cours"]) ?? ""
    ).trim();

    const stockRaw = pickColumn(r, [
      "stock",
      "qty",
      "quantite",
      "quantité",
      "qte",
      "inventaire",
    ]);
    const stock = stockRaw === "" || stockRaw == null ? 0 : Number(stockRaw);

    const priceRaw = pickColumn(r, ["price", "prix", "montant"]);
    const price = priceRaw === "" || priceRaw == null ? null : Number(priceRaw);

    if (!isbn && !title) continue;

    out.push({
      isbn: isbn || "(sans ISBN)",
      title: title || "(sans titre)",
      course: course || "",
      stock: Number.isFinite(stock) ? stock : 0,
      price: Number.isFinite(price) ? price : null,
      _status: computeStatus(stock),
    });
  }
  return out;
}

function StatCard({ label, value, hint, tone = "default" }) {
  return (
    <div className={`dashCard tone-${tone}`}>
      <div className="dashLabel">{label}</div>
      <div className="dashValue">{value}</div>
      {hint ? <div className="dashHint">{hint}</div> : null}
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [books, setBooks] = useState(() => {
    try {
      const raw = localStorage.getItem("availo_inventory_books");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => {
    try {
      const raw = localStorage.getItem("availo_inventory_lastUpdatedAt");
      return raw ? new Date(raw) : null;
    } catch {
      return null;
    }
  });

  // 🔐 Vérification connexion Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/admin/login");
      } else {
        setCurrentUser(user);
      }
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/admin/login");
  };

  const stats = useMemo(() => {
    const total = books.length;
    let available = 0,
      lowStock = 0,
      outOfStock = 0,
      totalUnits = 0;

    const byCourse = new Map();

    for (const b of books) {
      totalUnits += Math.max(0, b.stock || 0);

      if (b._status === "ok") available++;
      else if (b._status === "low") lowStock++;
      else if (b._status === "rupture") outOfStock++;

      const key = b.course?.trim() || "Autre";
      byCourse.set(key, (byCourse.get(key) || 0) + 1);
    }

    const topCourses = [...byCourse.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([course, count]) => ({ course, count }));

    return { total, available, lowStock, outOfStock, totalUnits, topCourses };
  }, [books]);

  // ------------------ IMPORT EXCEL ------------------
  async function handleFile(file) {
    setImportError("");
    setImporting(true);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      const sheetName = wb.SheetNames?.[0];
      if (!sheetName) throw new Error("Aucune feuille trouvée dans le fichier Excel.");

      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!rows.length) throw new Error("Le fichier Excel est vide (aucune ligne détectée).");

      const normalized = normalizeBooks(rows);

      if (!normalized.length) {
        throw new Error("Aucune ligne exploitable (vérifie les colonnes: ISBN/Titre/Stock).");
      }

      setBooks(normalized);
      setFileName(file.name);

      const now = new Date();
      setLastUpdatedAt(now);

      // 🔹 Enregistrement local (preview)
      localStorage.setItem("availo_inventory_books", JSON.stringify(normalized));
      localStorage.setItem("availo_inventory_lastUpdatedAt", now.toISOString());

      // 🔹 Envoi vers Firebase
      for (let book of normalized) {
        await addDoc(collection(db, "livres"), {
          titre: book.title,
          isbn: book.isbn,
          course: book.course,
          stock: book.stock,
          price: book.price ?? null,
          createdAt: serverTimestamp(),
        });
      }
    } catch (e) {
      setImportError(e?.message || "Erreur lors de l’import.");
    } finally {
      setImporting(false);
    }
  }

  function onChooseFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.name.toLowerCase().endsWith(".xls");
    if (!ok) {
      setImportError("Format non supporté. Choisis un fichier .xlsx ou .xls");
      return;
    }

    handleFile(file);
    e.target.value = "";
  }

  function clearLocalData() {
    localStorage.removeItem("availo_inventory_books");
    localStorage.removeItem("availo_inventory_lastUpdatedAt");
    setBooks([]);
    setLastUpdatedAt(null);
    setFileName("");
    setImportError("");
  }
  // ------------------ FIN IMPORT ------------------

  if (!authChecked) return null;

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner" style={{ justifyContent: "space-between", maxWidth: 1100 }}>
          <Link to="/" className="adminBackLink">← Retour</Link>
          <div className="adminTitleWrap">
            <div className="adminTitle">Admin</div>
            <div className="adminSubtitle">Import Excel + Dashboard</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {currentUser && (
              <span style={{ fontSize: "0.9rem", opacity: 0.7 }}>{currentUser.email}</span>
            )}
            <button className="actionBtn" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        <section className="dashHeader">
          <div>
            <h1 className="dashH1">Inventaire</h1>
            <p className="dashP">
              Importer un fichier Excel pour mettre à jour l’inventaire (mode local + Firebase).
            </p>
          </div>

          <div className="dashMeta">
            <div className="dashMetaLabel">Dernière mise à jour</div>
            <div className="dashMetaValue">
              {lastUpdatedAt
                ? new Intl.DateTimeFormat("fr-CA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(lastUpdatedAt)
                : "—"}
            </div>
          </div>
        </section>

        <section className="dashPanel" style={{ marginBottom: 12 }}>
          <div className="dashPanelTitle">Importer un fichier Excel (.xlsx)</div>
          <div className="dashPanelBody">
            <div className="importRow">
              <label className="actionBtn fileBtn">
                {importing ? "Import en cours…" : "Choisir un fichier"}
                <input type="file" accept=".xlsx,.xls" onChange={onChooseFile} hidden />
              </label>

              <div className="importMeta">
                <div className="importFile">{fileName ? `Fichier: ${fileName}` : "Aucun fichier importé"}</div>
                {books.length ? (
                  <div className="importSmall">{books.length} lignes chargées</div>
                ) : (
                  <div className="importSmall">
                    Import local : les données sont stockées dans ton navigateur
                  </div>
                )}
              </div>

              <button
                className="actionBtn"
                onClick={clearLocalData}
                disabled={!books.length || importing}
              >
                Vider
              </button>
            </div>

            {importError && <div className="notificationErr">{importError}</div>}
          </div>
        </section>

        <section className="dashGrid">
          <StatCard label="Livres" value={stats.total} hint="Nombre total de lignes importées" />
          <StatCard label="Disponibles" value={stats.available} hint="Stock > 2" tone="ok" />
          <StatCard label="Stock faible" value={stats.lowStock} hint="Stock 1–2" tone="warn" />
          <StatCard label="Ruptures" value={stats.outOfStock} hint="Stock = 0" tone="danger" />
          <StatCard label="Unités en stock" value={stats.totalUnits} hint="Somme des quantités" />
        </section>

        <section className="dashTwoCol" style={{ marginTop: 12 }}>
          <div className="dashPanel">
            <div className="dashPanelTitle">Top cours</div>
            <div className="dashPanelBody">
              {stats.topCourses.length ? (
                <ul className="dashList">
                  {stats.topCourses.map((c) => (
                    <li key={c.course} className="dashListItem">
                      <span className="dashListLeft">{c.course}</span>
                      <span className="dashListRight">{c.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">Aucune donnée.</div>
              )}
            </div>
          </div>

          <div className="dashPanel">
            <div className="dashPanelTitle">Aperçu (20 premières lignes)</div>
            <div className="dashPanelBody">
              {!books.length ? (
                <div className="empty">Importe un fichier pour voir l’aperçu.</div>
              ) : (
                <div className="tableWrap">
                  <table className="miniTable">
                    <thead>
                      <tr>
                        <th>Titre</th>
                        <th>ISBN</th>
                        <th>Cours</th>
                        <th>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {books.slice(0, 20).map((b, idx) => (
                        <tr key={b.isbn + idx}>
                          <td title={b.title}>{b.title}</td>
                          <td>{b.isbn}</td>
                          <td>{b.course || "—"}</td>
                          <td>{b.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}