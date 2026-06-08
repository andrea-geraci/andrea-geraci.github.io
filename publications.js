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

function makePublicationLine(pub) {
  const where = [];
  if (pub.journal) {
    where.push(pub.journal);
  }
  if (pub.volume) {
    where.push(`vol. ${pub.volume}${pub.number ? `(${pub.number})` : ""}`);
  }
  if (pub.pages) {
    where.push(`pp. ${pub.pages}`);
  }
  if (pub.year) {
    where.push(String(pub.year));
  }

  return where.join(", ");
}

function publicationCategory(pub) {
  if (pub.keywords.includes("journal")) {
    return "journal";
  }
  if (pub.keywords.includes("policy")) {
    return "policy";
  }
  if (pub.keywords.includes("bookchapter")) {
    return "bookchapter";
  }
  return "other";
}

function renderResearchStats(entries) {
  const statsEl = document.getElementById("research-stats");
  const recentEl = document.getElementById("recent-pubs");
  if (!statsEl || !recentEl) {
    return;
  }

  const journalCount = entries.filter((entry) => publicationCategory(entry) === "journal").length;
  const policyCount = entries.filter((entry) => publicationCategory(entry) === "policy").length;
  const totalCount = entries.length;

  statsEl.innerHTML = `
    <div class="stat-card"><strong>${totalCount}</strong><span>Total publications</span></div>
    <div class="stat-card"><strong>${journalCount}</strong><span>Journal articles</span></div>
    <div class="stat-card"><strong>${policyCount}</strong><span>Policy reports</span></div>
  `;

  const latest = entries.slice(0, 4);
  const latestItems = latest
    .map(
      (entry) => `
        <li>
          <span class="pub-title">${entry.title}</span>
          <span class="pub-meta">${entry.year} - ${entry.journal}</span>
        </li>
      `
    )
    .join("");

  recentEl.innerHTML = `
    <h3>Latest publications</h3>
    <ol class="pub-list">${latestItems}</ol>
  `;
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
      const authors = entry.authors.join(", ");
      const doi = entry.doi
        ? `<a href=\"https://doi.org/${entry.doi}\" target=\"_blank\" rel=\"noopener noreferrer\">DOI</a>`
        : "";

      return `
        <li>
          <span class="pub-title">${entry.title}</span>
          <span class="pub-meta">${authors}</span>
          <span class="pub-meta">${makePublicationLine(entry)}</span>
          ${doi ? `<span class="pub-links">${doi}</span>` : ""}
        </li>
      `;
    })
    .join("");

  const journalEntries = entries.filter((entry) => publicationCategory(entry) === "journal");
  const otherEntries = entries.filter((entry) => publicationCategory(entry) !== "journal");

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

    renderResearchStats(entries);
    renderPublications(entries);
  } catch (error) {
    const message = "Unable to load publications.bib. Check file path and format.";
    if (contentEl) {
      contentEl.innerHTML = `<p class=\"note\">${message}</p>`;
    }
    const statsEl = document.getElementById("research-stats");
    if (statsEl) {
      statsEl.innerHTML = `<p class=\"note\">${message}</p>`;
    }
  }
}

loadPublications();
