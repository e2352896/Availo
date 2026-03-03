import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../firebase/firebase.js";

function AutoFitTitleCover({ text, className = "" }) {
  const boxRef = useRef(null);
  const [fontSize, setFontSize] = useState(18);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    let size = 18;
    box.style.fontSize = `${size}px`;

    for (let i = 0; i < 16; i++) {
      const tooTall = box.scrollHeight > box.clientHeight;
      const tooWide = box.scrollWidth > box.clientWidth;
      if (!tooTall && !tooWide) break;

      size -= 1;
      if (size < 10) break;
      box.style.fontSize = `${size}px`;
    }

    setFontSize(size);
  }, [text]);

  return (
    <div
      ref={boxRef}
      className={`detailsCoverFallback ${className}`}
      style={{ fontSize }}
    >
      {text || "Sans titre"}
    </div>
  );
}

function computeStatus(stock) {
  const n = Number(stock ?? 0);
  if (n <= 0) return { label: "Rupture", tag: "pill-danger", rank: 3 };
  if (n <= 2) return { label: "Stock faible", tag: "pill-warn", rank: 2 };
  return { label: "Dispo", tag: "pill-ok", rank: 1 };
}

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
  } catch {
    return `${n.toFixed(2)} $`;
  }
}

// ===== PUSH NOTIFS (PWA) =====
const VAPID_PUBLIC_KEY =
  "BG4aPMWv_ebFnn47HI6zjopH3epL1Jc10-MelLBJRiH9RsmCPv5IWVDQd52sX9K8zPNUnAw8RBT3dRp_erqIFOI";

// URLs de tes functions
const FN_SUBSCRIBE =
  "https://us-central1-availo-162e8.cloudfunctions.net/subscribeBookAlert";
const FN_UNSUBSCRIBE =
  "https://us-central1-availo-162e8.cloudfunctions.net/unsubscribeBookAlert";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("SW not supported");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

function getLocalAlerts() {
  try {
    return JSON.parse(localStorage.getItem("availo_alert_books") || "[]");
  } catch {
    return [];
  }
}

function setLocalAlerts(arr) {
  localStorage.setItem("availo_alert_books", JSON.stringify(arr));
}

export default function BookDetailsPage() {
  const { isbn } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [book, setBook] = useState(null);

  const [alertBusy, setAlertBusy] = useState(false);
  const [alertOn, setAlertOn] = useState(false);

  const isbnClean = useMemo(
    () => String(isbn || "").replace(/[^0-9Xx]/g, "").toUpperCase(),
    [isbn]
  );

  const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbnClean}-L.jpg?default=false`;
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => setImgOk(true), [isbnClean]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");
      setBook(null);

      try {
        const qRef = query(collection(db, "livres"), where("isbn", "==", isbn), limit(1));
        const snap = await getDocs(qRef);

        if (!alive) return;

        if (!snap.empty) {
          const d = snap.docs[0];
          const data = d.data();

          const titre = (data.titre ?? "").toString();
          const editeur = (data.editeur ?? data.Editeur ?? data["Éditeur"] ?? "").toString();
          const stock = Number(data.stock ?? data.qte ?? data.quantite ?? 0);
          const prix = data.prix ?? data.price ?? null;

          setBook({
            id: d.id,
            isbn,
            title: titre || "(sans titre)",
            editeur,
            stock: Number.isFinite(stock) ? stock : 0,
            price: prix,
          });
          setLoading(false);
          return;
        }

        const allSnap = await getDocs(collection(db, "livres"));
        if (!alive) return;

        const found = allSnap.docs.find((d) => d.id === isbn);
        if (!found) {
          setErr("Livre introuvable.");
          setLoading(false);
          return;
        }

        const data = found.data();
        const titre = (data.titre ?? "").toString();
        const editeur = (data.editeur ?? data.Editeur ?? data["Éditeur"] ?? "").toString();
        const stock = Number(data.stock ?? data.qte ?? data.quantite ?? 0);
        const prix = data.prix ?? data.price ?? null;

        setBook({
          id: found.id,
          isbn,
          title: titre || "(sans titre)",
          editeur,
          stock: Number.isFinite(stock) ? stock : 0,
          price: prix,
        });
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr("Erreur lors du chargement du livre depuis Firestore.");
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [isbn]);

  // ✅ Etat local: est-ce que ce livre est déjà "suivi" ?
  useEffect(() => {
    if (!book?.id) return;
    const list = getLocalAlerts();
    setAlertOn(list.includes(book.id));
  }, [book?.id]);

  async function enableAlert() {
    if (!book?.id) return;
    setAlertBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Permission refusée");

      const reg = await ensureServiceWorker();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch(FN_SUBSCRIBE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, subscription: sub.toJSON() }),
      });

      const list = Array.from(new Set([...getLocalAlerts(), book.id]));
      setLocalAlerts(list);
      setAlertOn(true);
    } catch (e) {
      console.error(e);
      alert("Impossible d’activer les alertes (PWA push).");
    } finally {
      setAlertBusy(false);
    }
  }

  async function disableAlert() {
    if (!book?.id) return;
    setAlertBusy(true);
    try {
      const reg = await ensureServiceWorker();
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await fetch(FN_UNSUBSCRIBE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId: book.id, subscription: sub.toJSON() }),
        });
      }

      const list = getLocalAlerts().filter((x) => x !== book.id);
      setLocalAlerts(list);
      setAlertOn(false);
    } catch (e) {
      console.error(e);
      alert("Impossible de désactiver l’alerte.");
    } finally {
      setAlertBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <header className="topbar">
          <div className="topbar-inner" style={{ maxWidth: 1100 }}>
            <Link to="/" className="adminBackLink">← Retour</Link>
          </div>
        </header>
        <main className="content">
          <div className="empty">Chargement…</div>
        </main>
      </div>
    );
  }

  if (err || !book) {
    return (
      <div className="page">
        <header className="topbar">
          <div className="topbar-inner" style={{ maxWidth: 1100 }}>
            <Link to="/" className="adminBackLink">← Retour</Link>
          </div>
        </header>
        <main className="content">
          <div className="empty">{err || "Livre introuvable."}</div>
        </main>
      </div>
    );
  }

  const status = computeStatus(book.stock);
  const priceLabel = money(book.price);

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner" style={{ maxWidth: 1100 }}>
          <Link to="/" className="adminBackLink">← Retour</Link>
        </div>
      </header>

      <main className="content">
        <div className="detailsWrap">
          <div className="detailsCard">
            <div className="detailsLeft">
              <div className="detailsCover">
                {imgOk && isbnClean ? (
                  <img
                    src={coverUrl}
                    alt={book?.title || "Couverture"}
                    onError={() => setImgOk(false)}
                    loading="lazy"
                  />
                ) : (
                  <AutoFitTitleCover text={book?.title} />
                )}
              </div>
            </div>

            <div className="detailsRight">
              <div className="detailsTopRow">
                <span className={`pill ${status.tag}`}>{status.label}</span>
              </div>

              <h1 className="detailsTitle">{book.title}</h1>

              <div className="detailsMeta">
                <div className="detailsMetaRow">
                  <span className="detailsKey">ISBN</span>
                  <span className="detailsVal">{book.isbn}</span>
                </div>

                <div className="detailsMetaRow">
                  <span className="detailsKey">Éditeur</span>
                  <span className="detailsVal">{book.editeur}</span>
                </div>

                <div className="detailsMetaRow">
                  <span className="detailsKey">Stock</span>
                  <span className="detailsVal">{book.stock}</span>
                </div>

                <div className="detailsMetaRow">
                  <span className="detailsKey">Prix</span>
                  <span className="detailsVal">{priceLabel || "—"}</span>
                </div>
              </div>

              {/* ✅ BOUTON ALERTES */}
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {!alertOn ? (
                  <button
                    className="btn"
                    disabled={alertBusy || book.stock > 0}
                    onClick={enableAlert}
                    title={
                      book.stock > 0
                        ? "Le livre est déjà dispo"
                        : "Recevoir une notif quand il redevient dispo"
                    }
                  >
                    🔔 Ajouter aux alertes
                  </button>
                ) : (
                  <button className="btn" disabled={alertBusy} onClick={disableAlert}>
                    🔕 Retirer l’alerte
                  </button>
                )}
              </div>

              {/* Optionnel: petit texte d'aide */}
              <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
                Les alertes fonctionnent sur ce navigateur (sans compte). Si tu effaces les données du site, l’alerte disparaît.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}