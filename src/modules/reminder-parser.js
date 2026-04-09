function startOfHour(date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function setTime(date, hours, minutes = 0) {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function normalizeTitle(text) {
  return text
    .replace(/(mai|hôm nay|chieu nay|chiều nay|sáng mai|toi nay|tối nay|luc|lúc|\d+\s*gi[oờ])/gi, "")
    .replace(/\s+/g, " ")
    .trim() || "Nhắc việc bằng giọng nói";
}

export function createReminderParser() {
  return {
    extractReminder(transcript) {
      if (!transcript) {
        return null;
      }

      const now = new Date();
      const lower = transcript.toLowerCase();
      const hourMatch = lower.match(/(\d{1,2})\s*(giờ|g|h)(?:\s*(\d{1,2}))?/);

      let dueDate = null;

      if (lower.includes("mai")) {
        dueDate = addDays(now, 1);
      } else if (lower.includes("hôm nay") || lower.includes("hom nay")) {
        dueDate = new Date(now);
      } else if (lower.includes("tối nay") || lower.includes("toi nay")) {
        dueDate = setTime(now, 20, 0);
      } else if (lower.includes("chiều nay") || lower.includes("chieu nay")) {
        dueDate = setTime(now, 15, 0);
      } else {
        const dateMatch = lower.match(/ngày\s*(\d{1,2})(?:[\/\-](\d{1,2}))?/);
        if (dateMatch) {
          const day = Number(dateMatch[1]);
          const month = dateMatch[2] ? Number(dateMatch[2]) - 1 : now.getMonth();
          dueDate = new Date(now.getFullYear(), month, day);
        }
      }

      if (!dueDate && !hourMatch) {
        return null;
      }

      if (!dueDate) {
        dueDate = new Date(now);
      }

      if (hourMatch) {
        const hours = Number(hourMatch[1]);
        const minutes = hourMatch[3] ? Number(hourMatch[3]) : 0;
        dueDate = setTime(dueDate, hours, minutes);
      } else {
        dueDate = startOfHour(addDays(dueDate, 0));
      }

      if (dueDate <= now) {
        dueDate = addDays(dueDate, 1);
      }

      return {
        title: normalizeTitle(transcript),
        dueAt: dueDate.toISOString(),
      };
    },
  };
}
