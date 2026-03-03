importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCaFseDoKFwMzU2rnBUgvlbnGlsbA-6rjY",
  authDomain: "availo-162e8.firebaseapp.com",
  projectId: "availo-162e8",
  storageBucket: "availo-162e8.firebasestorage.app",
  messagingSenderId: "234385162653",
  appId: "1:234385162653:web:f896e4ab0f9fc27d5c2f74",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "📚 Availo";
  const body = payload?.notification?.body || "Mise à jour";
  const isbn = payload?.data?.isbn || "";

  self.registration.showNotification(title, {
    body,
    data: { isbn },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const isbn = event.notification?.data?.isbn;
  const url = isbn ? `/books/${isbn}` : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});