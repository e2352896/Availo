import { useMemo } from "react";
import { Link } from "react-router-dom";

// ✅ Pour l’instant: stats basées sur un mock (on remplacera par Firestore plus tard)
const MOCK_BOOKS = [
  { isbn: "9780131103627", title: "C Programming Language", course: "420-6D1", stock: 3, price: 79.99 },
  { isbn: "9780132350884", title: "Clean Code", course: "420-PA1", stock: 0, price: 69.99 },
  { isbn: "9780262033848", title: "Introduction to Algorithms", course: "420-6D9", stock: 1, price: 99.99 },
  { isbn: "9781491950296", title: "Designing Data-Intensive Applications", course: "420-BD1", stock: 7, price: 89.99 },
  { isbn: "9780134685991", title: "Effective Java", course: "420-JV1", stock: 2, price: 84.99 },
  { isbn: "9780201633610", title: "Design Patterns", course: "420-OO1", stock: 4, price: 74.99 },
];

function computeStatus(stock) {
  if (stock <= 0) return "rupture";
  if (stock <= 2) return "low";
  return "ok";
}

function formatDateTime(date) {
  try {
    return new Intl.DateTimeFormat("fr-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
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
  const stats = useMemo(() => {
    const total = MOCK_BOOKS.length;

    let available = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let totalUnits = 0;

    const byCourse = new Map();

    for (const b of MOCK_BOOKS) {
      const s = computeStatus(b.stock);
      totalUnits += Math.max(0, b.stock || 0);

      if (s === "ok") available += 1;
      if (s === "low") lowStock += 1;
      if (s === "rupture") outOfStock += 1;

      const key = b.course || "Autre";
      byCourse.set(key, (byCourse.get(key) || 0) + 1);
    }

    const topCourses = [...byCourse.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([course, count]) => ({ course, count }));

    // “Dernière MAJ” : en mock -> maintenant. Plus tard: meta.lastUpdatedAt depuis Firestore
    const lastUpdatedAt = new Date();

    // Bonus: “Top recherches” si tu stockes les recherches dans localStorage (optionnel)
    let topSearches = [];
    try {
      const raw = localStorage.getItem("availo_search_terms");
      const terms = raw ? JSON.parse(raw) : [];
      const freq = new Map();
      for (const t of terms) {
        const k = String(t || "").trim().toLowerCase();
        if (!k) continue;
        freq.set(k, (freq.get(k) || 0) + 1);
      }
      topSearches = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([term, count]) => ({ term, count }));
    } catch {
      topSearches = [];
    }

    return {
      total,
      available,
      lowStock,
      outOfStock,
      totalUnits,
      lastUpdatedAt,
      topCourses,
      topSearches,
    };
  }, []);

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner" style={{ justifyContent: "space-between", maxWidth: 1100 }}>
          <Link to="/" className="adminBackLink">← Retour</Link>
          <div className="adminTitleWrap">
            <div className="adminTitle">Admin</div>
            <div className="adminSubtitle">Dashboard</div>
          </div>
          <div className="adminPill">Lecture seule (mock)</div>
        </div>
      </header>

      <main className="content">
        <section className="dashHeader">
          <div>
            <h1 className="dashH1">Vue d’ensemble</h1>
            <p className="dashP">
              Statistiques basées sur les données actuelles. (On branchera Firestore après l’import Excel.)
            </p>
          </div>
          <div className="dashMeta">
            <div className="dashMetaLabel">Dernière mise à jour</div>
            <div className="dashMetaValue">{formatDateTime(stats.lastUpdatedAt)}</div>
          </div>
        </section>

        <section className="dashGrid">
          <StatCard label="Livres" value={stats.total} hint="Nombre total de livres" />
          <StatCard label="Disponibles" value={stats.available} hint="Stock > 2" tone="ok" />
          <StatCard label="Stock faible" value={stats.lowStock} hint="Stock 1–2" tone="warn" />
          <StatCard label="Ruptures" value={stats.outOfStock} hint="Stock = 0" tone="danger" />
          <StatCard label="Unités en stock" value={stats.totalUnits} hint="Somme des quantités" />
        </section>

        <section className="dashTwoCol">
          <div className="dashPanel">
            <div className="dashPanelTitle">Top cours (par nombre de livres)</div>
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
            <div className="dashPanelTitle">Top recherches (optionnel)</div>
            <div className="dashPanelBody">
              {stats.topSearches.length ? (
                <ul className="dashList">
                  {stats.topSearches.map((s) => (
                    <li key={s.term} className="dashListItem">
                      <span className="dashListLeft">{s.term}</span>
                      <span className="dashListRight">{s.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">
                  Rien encore. (Si tu veux, je te montre comment logger les recherches depuis HomePage.)
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="dashActions">
          <div className="dashPanel">
            <div className="dashPanelTitle">Prochaines actions</div>
            <div className="dashPanelBody">
              <div className="actionRow">
                <div>
                  <div className="actionTitle">Importer un fichier Excel</div>
                  <div className="actionHint">Mettre à jour l’inventaire depuis la COOP</div>
                </div>
                <button className="actionBtn" disabled>
                  Bientôt
                </button>
              </div>
              <div className="actionRow">
                <div>
                  <div className="actionTitle">Gérer les alertes</div>
                  <div className="actionHint">Voir qui attend quels livres</div>
                </div>
                <button className="actionBtn" disabled>
                  Bientôt
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}