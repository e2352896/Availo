import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("loading");
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;

      if (!user) {
        setStatus("unauthenticated");
        return;
      }

      try {
        const adminsQuery = query(
          collection(db, "admins"),
          where("uid", "==", user.uid),
          limit(1)
        );
        const snapshot = await getDocs(adminsQuery);
        if (!isMounted) return;
        setStatus(snapshot.empty ? "unauthenticated" : "authenticated");
      } catch (error) {
        console.error(error);
        if (!isMounted) return;
        setStatus("unauthenticated");
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (status === "loading") {
    return <div className="section has-text-centered">Verification...</div>;
  }

  if (status === "unauthenticated") {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname, denied: true }}
      />
    );
  }

  return children;
}
