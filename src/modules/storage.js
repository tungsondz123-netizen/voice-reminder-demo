const NOTES_KEY = "voice-reminder-notes";
const REMINDERS_KEY = "voice-reminder-reminders";

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function createStorage() {
  return {
    getNotes() {
      return read(NOTES_KEY).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    getReminders() {
      return read(REMINDERS_KEY).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    },
    saveNote(note) {
      const notes = [note, ...read(NOTES_KEY)];
      write(NOTES_KEY, notes);
      return notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    saveReminder(reminder) {
      const reminders = [...read(REMINDERS_KEY), reminder];
      write(REMINDERS_KEY, reminders);
      return reminders.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    },
    updateReminder(id, patch) {
      const reminders = read(REMINDERS_KEY).map((item) => {
        if (item.id !== id) {
          return item;
        }
        return { ...item, ...patch };
      });
      write(REMINDERS_KEY, reminders);
      return reminders.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    },
  };
}
