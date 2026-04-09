function formatDateTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function emptyState() {
  return `<div class="empty-state">Chưa có dữ liệu.</div>`;
}

export function createRenderer() {
  return {
    renderSuggestion(elements, suggestion) {
      if (!suggestion) {
        elements.reminderSuggestion.classList.add("is-hidden");
        return;
      }
      elements.reminderSuggestion.classList.remove("is-hidden");
      elements.suggestionTitle.textContent = suggestion.title;
      elements.suggestionDateText.textContent = `Nhắc lúc ${formatDateTime(suggestion.dueAt)}`;
    },
    filterNotes(notes, searchTerm) {
      if (!searchTerm) {
        return notes;
      }
      return notes.filter((note) => {
        return `${note.transcript} ${note.createdAt}`.toLowerCase().includes(searchTerm);
      });
    },
    filterReminders(reminders, searchTerm) {
      if (!searchTerm) {
        return reminders;
      }
      return reminders.filter((reminder) => {
        return `${reminder.title} ${reminder.dueAt}`.toLowerCase().includes(searchTerm);
      });
    },
    renderNotes(container, notes) {
      if (!notes.length) {
        container.innerHTML = emptyState();
        return;
      }
      container.innerHTML = notes.map((note) => {
        return `
          <article class="note-card">
            <h4>${note.transcript.slice(0, 42)}${note.transcript.length > 42 ? "..." : ""}</h4>
            <p>${note.transcript}</p>
            <div class="card-meta">
              <span>${formatDateTime(note.createdAt)}</span>
              <span>${note.reminderId ? "Co nhac viec" : "Chi la note"}</span>
            </div>
          </article>
        `;
      }).join("");
    },
    renderReminders(container, reminders) {
      if (!reminders.length) {
        container.innerHTML = emptyState();
        return;
      }
      container.innerHTML = reminders.map((reminder) => {
        return `
          <article class="note-card">
            <h4>${reminder.title}</h4>
            <p>${formatDateTime(reminder.dueAt)}</p>
            <div class="card-meta">
              <span>${reminder.status === "scheduled" ? "Dang cho" : "Da nhac"}</span>
              <button class="chip-button" disabled>${reminder.status === "scheduled" ? "Sap toi" : "Hoan tat"}</button>
            </div>
          </article>
        `;
      }).join("");
    },
  };
}
