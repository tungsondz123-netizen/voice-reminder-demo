import { createStorage } from "./storage.js";

const storage = createStorage();
const activeTimers = new Map();

function fireBrowserNotification(reminder) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    alert(`Đến giờ: ${reminder.title}`);
    return;
  }

  new Notification("Nhắc việc", {
    body: reminder.title,
    tag: reminder.id,
  });
}

export function createNotificationService() {
  function schedule(reminder) {
    const delay = new Date(reminder.dueAt).getTime() - Date.now();
    if (delay <= 0) {
      fireBrowserNotification(reminder);
      storage.updateReminder(reminder.id, { status: "fired" });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      fireBrowserNotification(reminder);
      storage.updateReminder(reminder.id, { status: "fired" });
      activeTimers.delete(reminder.id);
    }, delay);

    activeTimers.set(reminder.id, timeoutId);
  }

  return {
    async requestPermission() {
      if (!("Notification" in window)) {
        return false;
      }
      const permission = await Notification.requestPermission();
      return permission === "granted";
    },
    schedule,
    restoreScheduledChecks(onUpdate) {
      const reminders = storage.getReminders().filter((item) => item.status === "scheduled");
      reminders.forEach((reminder) => schedule(reminder));
      window.setInterval(() => {
        const updated = storage.getReminders();
        onUpdate(updated);
      }, 60000);
    },
  };
}
