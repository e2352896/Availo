import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import BookDetailsPage from "./pages/BookDetailsPage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/books/:isbn" element={<BookDetailsPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
