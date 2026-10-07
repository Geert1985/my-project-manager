const PROJECT_FILE_LIMIT = 10 * 1024 * 1024;
const INTERCHANGE_COLLECTIONS = ["projects", "tasks", "sources", "sourceVersions", "protocols", "protocolVersions", "protocolItems", "checks", "checkResults", "reviews"];

function interchangeError(message) { throw new Error(`Projectbestand: ${message}`); }

function parseProjectFile(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > PROJECT_FILE_LIMIT) interchangeError("bestand is te groot (maximaal 10 MiB).");
  try { return JSON.parse(text); } catch { interchangeError("geen geldig JSON-bestand."); }
}

function prepareProjectImport(file) {
  const now = new Date().toISOString();
  const staged = Object.fromEntries(INTERCHANGE_COLLECTIONS.map(key => [key, []]));
  const refs = Object.fromEntries(INTERCHANGE_COLLECTIONS.map(key => [key, new Map()]));
  let count = 0;
  const scan = [{ value:file, depth:0 }];
  let scanned = 0;
  while (scan.length) {
    const { value, depth } = scan.pop();
    if (++scanned > 200000 || depth > 120) interchangeError("bestand is te groot of te diep.");
    if (typeof value === "string" && value.length > 100000) interchangeError("tekst is te lang.");
    if (value && typeof value === "object") {
      if (Array.isArray(value) && value.length > 5000) interchangeError("collectie is te groot.");
      for (const key of Object.keys(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) interchangeError("verboden objectveld.");
        scan.push({value:value[key], depth:depth+1});
      }
    }
  }
  function object(value, allowed) {
    if (!value || typeof value !== "object" || Array.isArray(value)) interchangeError("object verwacht.");
    for (const key of Object.keys(value)) if (!allowed.includes(key)) interchangeError(`onbekend veld '${key}'.`);
    return value;
  }
  function string(value, required = false) {
    if (value === undefined && !required) return "";
    if (typeof value !== "string" || value.length > 100000 || (required && !value.trim())) interchangeError("ongeldige of ontbrekende tekst.");
    return value;
  }
  function date(value, nullable = false) {
    if (value === undefined) return nullable ? null : now;
    if (value === null && nullable) return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) interchangeError("ongeldige UTC-timestamp.");
    const canonical = value.replace(/(?:\.(\d{1,3}))?Z$/, (_, fraction) => `.${(fraction || "").padEnd(3,"0")}Z`);
    if (new Date(value).toISOString() !== canonical) interchangeError("niet bestaande datum.");
    return value;
  }
  function array(value, required = false) {
    if (value === undefined && !required) return [];
    if (!Array.isArray(value) || value.length > 5000) interchangeError("ongeldige of te grote collectie.");
    return value;
  }
  function fields(raw, texts, enums = {}, required = [], extras = [], bools = {}) {
    object(raw, [...texts, ...Object.keys(enums), ...Object.keys(bools), "ref", ...extras]);
    const out = {};
    for (const key of texts) out[key] = key.endsWith("At") ? date(raw[key], ["completedAt", "startedAt"].includes(key)) : string(raw[key], required.includes(key));
    for (const [key, values] of Object.entries(enums)) {
      out[key] = raw[key] === undefined ? values[0] : raw[key];
      if (!values.includes(out[key])) interchangeError(`ongeldige ${key}.`);
    }
    for (const [key, fallback] of Object.entries(bools)) {
      out[key] = raw[key] === undefined ? fallback : raw[key];
      if (typeof out[key] !== "boolean") interchangeError(`ongeldige ${key}.`);
    }
    return out;
  }
  function add(kind, raw, value) {
    if (++count > 5000) interchangeError("meer dan 5.000 objecten.");
    value.id = crypto.randomUUID();
    if (raw.ref !== undefined) {
      const ref = string(raw.ref, true);
      if (ref.length > 200 || refs[kind].has(ref)) interchangeError(`dubbele of te lange ref in ${kind}.`);
      refs[kind].set(ref, value);
    }
    staged[kind].push(value);
    return value;
  }
  function resolve(kind, ref) {
    string(ref, true);
    const value = refs[kind].get(ref);
    if (!value) interchangeError(`onbekende verwijzing in ${kind}.`);
    return value;
  }
  object(file, ["format", "formatVersion", "exportedAt", "project", "protocols", "checks"]);
  if (file.format !== "my-projects") interchangeError("onbekend format; verwacht my-projects.");
  if (file.formatVersion !== 1) interchangeError("niet ondersteunde formatVersion; verwacht 1.");
  if (file.exportedAt !== undefined) date(file.exportedAt);
  const p = file.project;
  const priority = { priority:["normal", "low", "high"] };
  const project = add("projects", p, fields(p, ["name", "description", "category", "createdAt", "updatedAt"],
    {...priority, status:["active", "completed", "archived"]}, ["name"], ["tasks", "sources"]));
  if (p.ref !== undefined) interchangeError("project heeft geen ref nodig.");

  function sources(raw, taskId) {
    for (const source of array(raw)) {
      const s = add("sources", source, {...fields(source, ["title", "author", "publisher", "url", "description", "createdAt", "updatedAt"],
        {type:["document", "book", "article", "website", "github", "other"]}, ["title"], ["versions"]), projectId:project.id, taskId});
      const names = new Set();
      for (const version of array(source.versions)) {
        const v = fields(version, ["version", "label", "contentHash", "fileName", "filePath", "url", "notes", "createdAt"], {}, ["version"]);
        if (names.has(v.version)) interchangeError("dubbele bronversie.");
        names.add(v.version);
        add("sourceVersions", version, {...v, sourceId:s.id});
      }
    }
  }
  function tasks(raw, parentId, depth) {
    const siblings = array(raw, parentId === null);
    if (depth > 50 && siblings.length) interchangeError("meer dan 50 taakniveaus.");
    siblings.forEach((task, sortOrder) => {
      const t = add("tasks", task, {...fields(task, ["name", "description", "createdAt", "completedAt"],
        {...priority, status:["not_started", "in_progress", "completed"], completionMode:["manual", "automatic"]}, ["name"], ["children", "sources"]),
        projectId:project.id, parentId, sortOrder});
      sources(task.sources, t.id);
      if (task.children !== undefined) tasks(task.children, t.id, depth+1);
    });
  }
  tasks(p.tasks, null, 1);
  sources(p.sources, null);
  for (const protocol of array(file.protocols)) {
    const pr = add("protocols", protocol, fields(protocol, ["name", "version", "description", "createdAt", "updatedAt"], {}, ["name", "version"], ["versions"], {active:true}));
    const names = new Set(); let activeCount = 0;
    for (const version of array(protocol.versions, true)) {
      const v = add("protocolVersions", version, {...fields(version, ["version", "description", "createdAt"], {status:["active", "draft", "retired"]}, ["version"], ["items"]), protocolId:pr.id});
      if (names.has(v.version) || (v.status === "active" && ++activeCount > 1)) interchangeError("dubbele of meerdere actieve protocolversies.");
      names.add(v.version);
      const orders = new Set();
      array(version.items, true).forEach((item, index) => {
        object(item, ["ref", "title", "description", "createdAt", "updatedAt", "required", "order"]);
        const order = item.order === undefined ? index+1 : item.order;
        if (!Number.isSafeInteger(order) || order < 1 || orders.has(order)) interchangeError("ongeldige of dubbele itemvolgorde.");
        orders.add(order);
        add("protocolItems", item, {...fields(item, ["title", "description", "createdAt", "updatedAt"], {}, ["title"], ["order"], {required:true}), protocolId:pr.id, protocolVersionId:v.id, order});
      });
    }
  }
  for (const check of array(file.checks)) {
    object(check, ["ref", "summary", "createdAt", "startedAt", "completedAt", "status", "taskRef", "sourceVersionRef", "protocolRef", "protocolVersionRef", "protocolVersion", "results", "review"]);
    const task = resolve("tasks", check.taskRef), sv = resolve("sourceVersions", check.sourceVersionRef);
    const pr = resolve("protocols", check.protocolRef), pv = resolve("protocolVersions", check.protocolVersionRef);
    const source = staged.sources.find(item => item.id === sv.sourceId);
    if (source.taskId !== task.id || pv.protocolId !== pr.id) interchangeError("controle heeft ongeldige taak/bron/protocolrelatie.");
    const ch = add("checks", check, {...fields(check, ["summary", "createdAt", "startedAt", "completedAt"], {status:["not_started", "in_progress", "passed", "failed", "blocked"]}, [],
      ["taskRef", "sourceVersionRef", "protocolRef", "protocolVersionRef", "protocolVersion", "results", "review"]),
      taskId:task.id, sourceVersionId:sv.id, protocolId:pr.id, protocolVersionId:pv.id,
      protocolVersion:check.protocolVersion === undefined ? pv.version : string(check.protocolVersion, true)});
    if (ch.protocolVersion !== pv.version) interchangeError("protocolversiesnapshot wijkt af.");
    if (pv.status === "draft") interchangeError("controle verwijst naar een draft-protocolversie.");
    const itemIds = new Set();
    for (const result of array(check.results, true)) {
      object(result, ["ref", "comment", "evidence", "createdAt", "updatedAt", "status", "itemRef"]);
      const item = resolve("protocolItems", result.itemRef);
      if (item.protocolVersionId !== pv.id || itemIds.has(item.id)) interchangeError("ongeldig of dubbel controleresultaat.");
      itemIds.add(item.id);
      add("checkResults", result, {...fields(result, ["comment", "evidence", "createdAt", "updatedAt"], {status:["not_checked", "pass", "fail", "not_applicable"]}, [], ["itemRef"]), checkId:ch.id, protocolItemId:item.id});
    }
    if (staged.protocolItems.filter(item => item.protocolVersionId === pv.id).length !== itemIds.size) interchangeError("controleresultaten zijn onvolledig.");
    const results = staged.checkResults.filter(result => result.checkId === ch.id);
    if ((ch.status === "passed" && (!results.length || results.some(r => ["not_checked", "fail"].includes(r.status))))
      || (ch.status === "failed" && !results.some(r => r.status === "fail"))) interchangeError("controlestatus past niet bij de resultaten.");
    if (check.review !== undefined) {
      const review = fields(check.review, ["reviewer", "comment", "createdAt"], {status:["pending", "approved", "rejected"]}, ["reviewer"]);
      if (!["passed", "failed"].includes(ch.status) || (ch.status === "failed" && review.status === "approved")) interchangeError("review is niet geldig bij deze controlestatus.");
      add("reviews", check.review, {...review, checkId:ch.id});
    }
  }
  if (staged.protocolVersions.some(version => !staged.checks.some(check => check.protocolVersionId === version.id))
    || staged.protocols.some(protocol => !staged.checks.some(check => check.protocolId === protocol.id))) interchangeError("protocolsectie bevat versies zonder projectcontrole.");
  return staged;
}

function importProjectFile(file) {
  const staged = prepareProjectImport(file);
  const previous = state;
  const candidate = {...state};
  for (const key of INTERCHANGE_COLLECTIONS) candidate[key] = [...state[key], ...staged[key]];
  state = candidate;
  try { saveState(); } catch (error) { state = previous; throw new Error(`Project kon niet worden opgeslagen: ${error.message}`); }
  return staged.projects[0];
}

function exportProjectFile(projectId) {
  const project = getProject(projectId);
  if (!project) interchangeError("project bestaat niet.");
  const pick = (item, keys) => Object.fromEntries(keys.filter(key => item[key] !== undefined).map(key => [key, item[key]]));
  const maps = Object.fromEntries(INTERCHANGE_COLLECTIONS.map(key => [key, new Map()]));
  const ref = (kind, id) => {
    if (!state[kind].some(item => item.id === id)) interchangeError(`beschadigde verwijzing in ${kind}.`);
    if (!maps[kind].has(id)) maps[kind].set(id, `${kind}-${maps[kind].size+1}`);
    return maps[kind].get(id);
  };
  const usedTasks = new Set();
  const usedSources = new Set();
  const exportSources = taskId => state.sources.filter(s => s.projectId === projectId && (s.taskId || null) === taskId).map(s => {
    usedSources.add(s.id);
    return {...pick(s,["type","title","author","publisher","url","description","createdAt","updatedAt"]), ref:ref("sources",s.id),
      versions:getSourceVersions(s.id).map(v => ({...pick(v,["version","label","contentHash","fileName","filePath","url","notes","createdAt"]), ref:ref("sourceVersions",v.id)}))};
  });
  const tree = (parentId, depth=1) => {
    const siblings = getSiblingTasks(projectId,parentId);
    if (depth > 50 && siblings.length) interchangeError("taakboom is te diep.");
    return siblings.map(t => {
      if (usedTasks.has(t.id)) interchangeError("cyclische taakboom.");
      usedTasks.add(t.id);
      return {...pick(t,["name","description","status","priority","completionMode","createdAt","completedAt"]), ref:ref("tasks",t.id), children:tree(t.id,depth+1), sources:exportSources(t.id)};
    });
  };
  const data = {format:"my-projects", formatVersion:1, exportedAt:new Date().toISOString(),
    project:{...pick(project,["name","description","category","status","priority","createdAt","updatedAt"]), tasks:tree(null), sources:exportSources(null)}};
  if (getProjectTasks(projectId).length !== usedTasks.size || getProjectSources(projectId).length !== usedSources.size
    || state.sources.some(source => usedTasks.has(source.taskId) && source.projectId !== projectId)) interchangeError("project bevat verweesde taken of bronnen.");
  const checks = state.checks.filter(c => usedTasks.has(c.taskId));
  if (state.checks.some(c => !usedTasks.has(c.taskId) && state.sourceVersions.some(v => v.id === c.sourceVersionId && usedSources.has(v.sourceId)))) interchangeError("controle verwijst vanuit een andere taak naar dit project.");
  const protocolIds = new Set(checks.map(c => c.protocolId));
  const versionIds = new Set(checks.map(c => c.protocolVersionId));
  data.protocols = [...protocolIds].map(id => {
    const pr = getProtocol(id);if (!pr) interchangeError("protocol ontbreekt.");
    return {...pick(pr,["name","version","description","active","createdAt","updatedAt"]),ref:ref("protocols",id),
      versions:getProtocolVersions(id).filter(v => versionIds.has(v.id)).map(v => ({...pick(v,["version","description","status","createdAt"]),ref:ref("protocolVersions",v.id),
        items:getProtocolItemsForVersion(v.id).map(i => {
          if (i.protocolId !== pr.id) interchangeError("protocolitem hoort bij een ander protocol.");
          return {...pick(i,["title","description","required","order","createdAt","updatedAt"]),ref:ref("protocolItems",i.id)};
        })}))};
  });
  data.checks = checks.map(c => {
    const reviews = state.reviews.filter(r => r.checkId === c.id);
    if (reviews.length > 1) interchangeError("meerdere reviews voor één controle.");
    return {...pick(c,["status","summary","protocolVersion","startedAt","completedAt","createdAt"]),ref:ref("checks",c.id),
      taskRef:ref("tasks",c.taskId),sourceVersionRef:ref("sourceVersions",c.sourceVersionId),protocolRef:ref("protocols",c.protocolId),protocolVersionRef:ref("protocolVersions",c.protocolVersionId),
      results:getCheckResults(c.id).map(r => ({...pick(r,["status","comment","evidence","createdAt","updatedAt"]),ref:ref("checkResults",r.id),itemRef:ref("protocolItems",r.protocolItemId)})),
      ...(reviews[0] ? {review:{...pick(reviews[0],["status","reviewer","comment","createdAt"]),ref:ref("reviews",reviews[0].id)}} : {})};
  });
  prepareProjectImport(data); // The same relationship validation applies to backups.
  if (new TextEncoder().encode(JSON.stringify(data)).length > PROJECT_FILE_LIMIT) interchangeError("export is groter dan 10 MiB.");
  return data;
}
