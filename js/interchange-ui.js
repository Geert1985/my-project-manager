function chooseProjectImport() {
  document.getElementById("projectImportFile").click();
}

function downloadProject(projectId) {
  try {
    const data = exportProjectFile(projectId);
    const slug = data.project.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0,80) || "project";
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    if (blob.size > PROJECT_FILE_LIMIT) interchangeError("export is groter dan 10 MiB.");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `my-projects-${slug}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { alert(error.message); }
}

let projectImportBusy = false;
document.getElementById("projectImportFile").addEventListener("change", async event => {
  const input = event.target;
  const file = input.files[0];
  if (!file || projectImportBusy) return;
  projectImportBusy = true;
  try {
    if (file.size > PROJECT_FILE_LIMIT) interchangeError("bestand is te groot (maximaal 10 MiB).");
    const data = parseProjectFile(await file.text());
    const project = importProjectFile(data);
    openProject(project.id);
  } catch (error) { alert(error.message); }
  finally { input.value = ""; projectImportBusy = false; }
});
