const element = (id) => document.getElementById(id);

async function request(path, options) {
  const response = await fetch(path, { ...options, signal: AbortSignal.timeout(10_000) });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(`${body.title ?? "Request failed"} (HTTP ${response.status})`);
    error.traceId = body.traceId;
    throw error;
  }
  return body;
}

async function loadCatalog() {
  element("load-catalog").disabled = true;
  element("products").replaceChildren();
  const status = element("catalog-status");
  status.className = "";
  status.textContent = "Requesting database and inventory data...";
  try {
    const result = await request("/api/catalog");
    for (const item of result.items) {
      const row = document.createElement("tr");
      for (const value of [item.name, item.price.toFixed(2), item.quantity]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      element("products").append(row);
    }
    element("trace-id").textContent = result.traceId;
    status.textContent = `${result.items.length} products loaded from ${result.region}. HTTP 200.`;
    status.className = "success";
  } catch (error) {
    status.textContent = error.message;
    status.className = "error";
    element("trace-id").textContent = error.traceId ?? "No API trace returned";
    console.error("Catalog request failed.", error);
  } finally {
    element("load-catalog").disabled = false;
  }
}

async function loadState(write) {
  element("save-state").disabled = true;
  element("read-state").disabled = true;
  const status = element("state-status");
  status.className = "";
  try {
    const result = await request("/api/state", write ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: element("message").value }),
    } : undefined);
    element("state-output").textContent = JSON.stringify(result, null, 2);
    status.textContent = write ? "Note saved to application storage." : "State read from application storage.";
    status.className = "success";
  } catch (error) {
    status.textContent = error.message;
    status.className = "error";
    console.error("State request failed.", error);
  } finally {
    element("save-state").disabled = false;
    element("read-state").disabled = false;
  }
}

element("load-catalog").addEventListener("click", loadCatalog);
element("read-state").addEventListener("click", () => loadState(false));
element("state-form").addEventListener("submit", (event) => {
  event.preventDefault();
  loadState(true);
});
loadCatalog();
loadState(false);
