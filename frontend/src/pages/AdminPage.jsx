import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase.js";
import * as XLSX from "xlsx";
import { doc, getDocs, deleteDoc, writeBatch, serverTimestamp } from "firebase/firestore";

function pick(row, candidates) {
  const keys = Object.keys(row || {});
  for (const c of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase() === c);
    if (found) return row[found];
  }
  return undefined;
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRows(rows) {
  return rows
    .map((r) => {
      const isbn = String(pick(r, ["isbn", "ean", "barcode", "isbn13"]) ?? "").trim();
      const titre = String(pick(r, ["titre", "title", "nom", "produit", "description"]) ?? "").trim();
      const cours = String(pick(r, ["cours", "course", "code cours", "code_cours"]) ?? "").trim();

      const editeur = String(
        pick(r, ["editeur", "éditeur", "publisher"]) ?? ""
      ).trim();

      const stockRaw = pick(r, ["stock", "qte", "quantite", "quantité", "qty", "inventaire"]);
      const stock = toNumber(stockRaw, 0);

      const prixRaw = pick(r, ["prix", "price", "montant"]);
      const prix = prixRaw === "" || prixRaw == null ? null : toNumber(prixRaw, null);

      if (!isbn || !titre) return null;
      return { isbn, titre, cours, editeur, stock, prix };
    })
    .filter(Boolean);
}

function computeStatus(stock) {
  const n = Number(stock ?? 0);
  if (n <= 0) return "rupture";
  if (n <= 2) return "low";
  return "ok";
}

function formatDateTime(date) {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("fr-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return String(date);
  }
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
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  async function handleExcelUpload(file) {
    setImportMsg("");
    setImporting(true);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames?.[0];
      if (!sheetName) throw new Error("Aucune feuille trouvée dans le fichier.");

      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rows.length) throw new Error("Le fichier est vide.");

      const books = normalizeRows(rows);
      if (!books.length) throw new Error("Aucune ligne exploitable (ISBN + Titre requis).");

      let total = 0;
      let batch = writeBatch(db);
      let ops = 0;

      const snap = await getDocs(collection(db, "livres"));
      let delBatch = writeBatch(db);
      let delOps = 0;

      for (const d of snap.docs) {
        delBatch.delete(d.ref);
        delOps++;

        if (delOps === 450) {
          await delBatch.commit();
          delBatch = writeBatch(db);
          delOps = 0;
        }
      }

      if (delOps > 0) await delBatch.commit();

      for (const b of books) {
        const ref = doc(collection(db, "livres"), b.isbn);

        batch.set(
          ref,
          {
            titre: b.titre,
            editeur: b.editeur ?? "",            
            stock: b.stock,
            prix: b.prix,
            updatedAt: serverTimestamp(),
          },
        );

        ops++;
        total++;

        if (ops === 450) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }

      if (ops > 0) await batch.commit();

      setImportMsg(`✅ Import terminé : ${total} livres mis à jour dans Firestore.`);
    } catch (e) {
      console.error(e);
      setImportMsg(`❌ Import échoué : ${e?.message || "Erreur inconnue"}`);
    } finally {
      setImporting(false);
    }
  }

  function onChooseExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    handleExcelUpload(file);
    e.target.value = "";
  }

  useEffect(() => {
    setLoading(true);
    setErr("");

    const unsub = onSnapshot(
      collection(db, "livres"),
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();

          const titre = (data.titre ?? "").toString();
          const cours = (data.cours ?? data.course ?? "").toString();

          const stock = Number(data.stock ?? data.qte ?? data.quantite ?? 0);
          const prix = data.prix ?? data.price ?? null;

          return {
            id: d.id,
            title: titre || "(sans titre)",
            course: cours || "",
            stock: Number.isFinite(stock) ? stock : 0,
            price: prix,
            _status: computeStatus(stock),
          };
        });

        setBooks(rows);
        setLastUpdatedAt(new Date());
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setErr("Impossible de charger les données depuis Firestore (collection livres).");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const total = books.length;

    let available = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let totalUnits = 0;

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

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner" style={{ justifyContent: "space-between", maxWidth: 1100 }}>
          <Link to="/" className="adminBackLink">← Retour</Link>

          <div className="adminTitleWrap">
            <div className="adminTitle">Admin</div>
            <div className="adminSubtitle">Dashboard (Firestore)</div>
          </div>

          {/* ✅ MODIFICATION ICI */}
          <Link to="/admin/gestion" className="adminPill" style={{ textDecoration: "none" }}>
            Gestion
          </Link>
        </div>
      </header>

      <main className="content">
        <section className="dashHeader">
          <div>
            <h1 className="dashH1">Vue d’ensemble</h1>
            <p className="dashP">
              Statistiques basées sur Firestore (<code>livres</code>).
            </p>
          </div>

          <div className="dashMeta">
            <div className="dashMetaLabel">Dernière synchronisation</div>
            <div className="dashMetaValue">{formatDateTime(lastUpdatedAt)}</div>
          </div>
        </section>

        {err ? <div className="notificationErr">{err}</div> : null}

        <section className="dashGrid">
          <StatCard label="Livres" value={loading ? "—" : stats.total} hint="Nombre total" />
          <StatCard label="Disponibles" value={loading ? "—" : stats.available} hint="Stock > 2" tone="ok" />
          <StatCard label="Stock faible" value={loading ? "—" : stats.lowStock} hint="Stock 1–2" tone="warn" />
          <StatCard label="Ruptures" value={loading ? "—" : stats.outOfStock} hint="Stock = 0" tone="danger" />
          <StatCard label="Unités en stock" value={loading ? "—" : stats.totalUnits} hint="Somme des quantités" />
        </section>

        <section className="dashTwoCol" style={{ marginTop: 12 }}>
          <div className="dashPanel">
            <div className="dashPanelTitle">Top cours (par nombre de livres)</div>
            <div className="dashPanelBody">
              {loading ? (
                <div className="empty">Chargement…</div>
              ) : stats.topCourses.length ? (
                <ul className="dashList">
                  {stats.topCourses.map((c) => (
                    <li key={c.course} className="dashListItem">
                      <span className="dashListLeft">{c.course}</span>
                      <span className="dashListRight">{c.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">Aucune donnée “cours” trouvée.</div>
              )}
            </div>
          </div>

          <div className="dashPanel">
            <div className="dashPanelTitle">Aperçu (20 premiers livres)</div>
            <div className="dashPanelBody">
              {loading ? (
                <div className="empty">Chargement…</div>
              ) : !books.length ? (
                <div className="empty">Aucun livre dans Firestore.</div>
              ) : (
                <div className="tableWrap">
                  <table className="miniTable">
                    <thead>
                      <tr>
                        <th>Titre</th>
                        <th>Cours</th>
                        <th>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {books.slice(0, 20).map((b) => (
                        <tr key={b.id}>
                          <td title={b.title}>{b.title}</td>
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

        <div className="dashPanel" style={{ marginBottom: 12 }}>
          <div className="dashPanelTitle">Import Excel → Firestore</div>
          <div className="dashPanelBody">
            <label className="actionBtn fileBtn" style={{ cursor: "pointer" }}>
              {importing ? "Import en cours…" : "Choisir un fichier Excel"}
              <input type="file" accept=".xlsx,.xls" onChange={onChooseExcel} hidden />
            </label>

            {importMsg ? (
              <div style={{ marginTop: 12 }} className="importStatus">
                {importMsg}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}