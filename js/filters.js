function createFilterChips(target, values, selectedValue, onSelect, allLabel = "Tutti") {
  target.innerHTML = "";
  const withAll = [allLabel, ...values];

  withAll.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip ${selectedValue === value ? "active" : ""}`.trim();
    button.textContent = value;
    button.setAttribute("aria-pressed", String(selectedValue === value));
    button.addEventListener("click", () => onSelect(value));
    target.appendChild(button);
  });
}

function getUniqueGenres(items, key = "genre") {
  return [...new Set(items.flatMap((item) => item[key]))].sort((a, b) => a.localeCompare(b, "it"));
}
