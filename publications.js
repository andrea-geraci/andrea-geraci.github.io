function splitAuthors(authorField) {
  if (!authorField) {
    return [];
  }

  return authorField
    .split(/\s+and\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => {
      if (name.includes(",")) {
        const parts = name.split(",").map((part) => part.trim());
        return parts.length > 1 ? parts.slice(1).join(" ") + " " + parts[0] : name;
      }
      return name;
    });
}

function formatAuthorAPA(authorName) {
  const trimmed = authorName.trim();
  if (!trimmed) {
    return "";
  }

  let surname = "";
  let givenNames = "";

  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
    surname = parts[0] || "";
    givenNames = parts.slice(1).join(" ");
  } else {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    surname = parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
    givenNames = parts.slice(0, -1).join(" ");
  }

  const initials = givenNames
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => `${name[0].toUpperCase()}.`)
    .join(" ");

  return initials ? `${surname}, ${initials}` : surname;
}

function formatAuthorsAPA(authorField) {
  if (!authorField) {
    return "";
  }

  const formatted = authorField
    .split(/\s+and\s+/i)
    .map((name) => formatAuthorAPA(name))
    .filter(Boolean);

  if (formatted.length === 0) {
    return "";
  }

  if (formatted.length === 1) {
    return formatted[0];
  }

  if (formatted.length === 2) {
    return `${formatted[0]} & ${formatted[1]}`;
  }

  return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
}

function ensureTrailingPeriod(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function cleanValue(value) {
  return value
    .replace(/^\{+|\}+$/g, "")
    .replace(/^"+|"+$/g, "")
    .replace(/\\&/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBibEntry(entryText) {
  const entryHeader = entryText.match(/^\s*@([a-zA-Z]+)\s*\{\s*([^,]+),/);
  if (!entryHeader) {
    return null;
  }

  const entryType = entryHeader[1].toLowerCase();
  const entryKey = entryHeader[2].trim();
  const fields = {};

  let i = entryHeader[0].length;
  while (i < entryText.length) {
    while (i < entryText.length && /[\s,]/.test(entryText[i])) {
      i += 1;
    }

    if (i >= entryText.length || entryText[i] === "}") {
      break;
    }

    const keyMatch = entryText.slice(i).match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*/);
    if (!keyMatch) {
      break;
    }

    const fieldName = keyMatch[1].toLowerCase();
    i += keyMatch[0].length;

    let rawValue = "";
    if (entryText[i] === "{") {
      let depth = 0;
      while (i < entryText.length) {
        const char = entryText[i];
        rawValue += char;
        if (char === "{") {
          depth += 1;
        } else if (char === "}") {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
        i += 1;
      }
    } else if (entryText[i] === '"') {
      rawValue += entryText[i];
      i += 1;
      while (i < entryText.length) {
        const char = entryText[i];
        rawValue += char;
        i += 1;
        if (char === '"' && entryText[i - 2] !== "\\") {
          break;
        }
      }
    } else {
      while (i < entryText.length && entryText[i] !== "," && entryText[i] !== "}") {
        rawValue += entryText[i];
        i += 1;
      }
    }

    fields[fieldName] = cleanValue(rawValue);
  }

  return {
    type: entryType,
    key: entryKey,
    title: fields.title || "Untitled",
    rawAuthors: fields.author || "",
    authors: splitAuthors(fields.author),
    journal: fields.journal || fields.booktitle || "",
    year: Number.parseInt(fields.year || "0", 10) || 0,
    volume: fields.volume || "",
    number: fields.number || "",
    pages: fields.pages || "",
    publisher: fields.publisher || "",
    keywords: (fields.keywords || "").toLowerCase(),
    doi: fields.doi || "",
  };
}

function parseBibTex(content) {
  const entries = [];
  const chunks = content.split(/\n@/);

  chunks.forEach((chunk, index) => {
    const normalized = index === 0 ? chunk : "@" + chunk;
    if (!normalized.trim().startsWith("@")) {
      return;
    }

    const entry = parseBibEntry(normalized);
    if (entry) {
      entries.push(entry);
    }
  });

  return entries.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
}

function publicationCategory(pub) {
  if (pub.keywords.includes("journal")) {
    return "journal";
  }
  if (
    pub.keywords.includes("workingpaper") ||
    pub.keywords.includes("workinprogress") ||
    pub.keywords.includes("wip") ||
    pub.keywords.includes("working")
  ) {
    return "working";
  }
  return "other";
}

function projectCoauthors(entry) {
  const coauthors = (entry.authors || []).filter(
    (name) => name.toLowerCase() !== "andrea geraci"
  );
  return coauthors.join(", ");
}

function renderPublications(entries) {
  const contentEl = document.getElementById("publications-content");
  if (!contentEl) {
    return;
  }

  if (entries.length === 0) {
    contentEl.innerHTML = "<p class=\"note\">No publications in this category.</p>";
    return;
  }

  const renderList = (items) =>
    items
    .map((entry) => {
      const authorsApa = formatAuthorsAPA(entry.rawAuthors);
      const yearPart = entry.year ? `(${entry.year}).` : "(n.d.).";
      const titlePart = ensureTrailingPeriod(entry.title);
      const sourceParts = [];

      if (entry.journal) {
        sourceParts.push(`<span class="pub-journal">${entry.journal}</span>`);
      }
      if (entry.volume) {
        sourceParts.push(
          `<span class="pub-volume">${entry.volume}</span>${entry.number ? `(${entry.number})` : ""}`
        );
      }
      if (entry.pages) {
        sourceParts.push(entry.pages);
      }

      const sourcePart = sourceParts.length ? `${sourceParts.join(", ")}.` : "";
      const doi = entry.doi
        ? `<a href="https://doi.org/${entry.doi}" target="_blank" rel="noopener noreferrer">https://doi.org/${entry.doi}</a>`
        : "";

      return `
        <li>
          <p class="apa-entry">
            ${authorsApa ? `<span class="apa-authors">${authorsApa}</span> ` : ""}
            <span class="apa-year">${yearPart}</span>
            <span class="apa-title"> ${titlePart}</span>
            ${sourcePart ? `<span class="apa-source"> ${sourcePart}</span>` : ""}
          </p>
          ${doi ? `<span class="pub-links">${doi}</span>` : ""}
        </li>
      `;
    })
    .join("");

  const journalEntries = entries.filter((entry) => publicationCategory(entry) === "journal");
  const otherEntries = entries.filter(
    (entry) => publicationCategory(entry) !== "journal" && publicationCategory(entry) !== "working"
  );

  const journalHtml = journalEntries.length
    ? `<ol class="pub-list full">${renderList(journalEntries)}</ol>`
    : "<p class=\"note\">No journal articles yet.</p>";

  const otherHtml = otherEntries.length
    ? `<ol class="pub-list full">${renderList(otherEntries)}</ol>`
    : "<p class=\"note\">No other contributions yet.</p>";

  contentEl.innerHTML = `
    <section class="pub-group">
      <h3>Journal Articles</h3>
      ${journalHtml}
    </section>
    <section class="pub-group">
      <h3>Other Contributions</h3>
      ${otherHtml}
    </section>
  `;
}

function renderCurrentProjects(entries) {
  const projectsEl = document.getElementById("current-projects-content");
  if (!projectsEl) {
    return;
  }

  const workingEntries = entries.filter((entry) => publicationCategory(entry) === "working");
  if (workingEntries.length === 0) {
    projectsEl.innerHTML = "<p class=\"note\">No current projects listed yet.</p>";
    return;
  }

  const items = workingEntries
    .map((entry) => {
      const withCoauthors = projectCoauthors(entry);
      return `
        <li>
          <span class="project-title">${entry.title}</span>
          ${withCoauthors ? `<span class="pub-meta">with ${withCoauthors}</span>` : ""}
        </li>
      `;
    })
    .join("");

  projectsEl.innerHTML = `<ul class="projects-list">${items}</ul>`;
}

async function loadPublications() {
  const contentEl = document.getElementById("publications-content");
  if (contentEl) {
    contentEl.innerHTML = "<p class=\"note\">Loading publications...</p>";
  }

  try {
    const response = await fetch("publications.bib", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch publications.bib (${response.status})`);
    }

    const bibText = await response.text();
    const entries = parseBibTex(bibText);

    renderPublications(entries);
    renderCurrentProjects(entries);
  } catch (error) {
    const message = "Unable to load publications.bib. Check file path and format.";
    if (contentEl) {
      contentEl.innerHTML = `<p class=\"note\">${message}</p>`;
    }

    const projectsEl = document.getElementById("current-projects-content");
    if (projectsEl) {
      projectsEl.innerHTML = `<p class=\"note\">${message}</p>`;
    }
  }
}

loadPublications();
