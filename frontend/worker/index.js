self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "系統推播", body: event.data.text() };
    }
  }

  const title = data.title || "AI 提醒";
  const options = {
    body: data.body || "您有一個新的提醒！",
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge.png',
    data: {
      url: data.url || self.location.origin
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
