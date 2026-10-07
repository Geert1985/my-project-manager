const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let saved = null;
let writes = 0;
const context = vm.createContext({
  console, crypto: require('node:crypto').webcrypto, structuredClone,
  localStorage: { getItem: () => saved, setItem: (key, value) => { saved = value; writes++; } }
});
for (const file of ['storage', 'tasks', 'projects', 'sources']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), context);
}
const run = code => vm.runInContext(code, context);
let passed = 0;
function test(name, code) {
  assert.equal(run(code), true, name);
  passed++;
  console.log('PASS ' + name);
}
run(`var legacy = {schemaVersion:4, projects:[{id:'p'},{id:'q'}],
  tasks:[{id:'a',projectId:'p',parentId:null,status:'not_started'},
    {id:'b1',projectId:'p',parentId:'b',status:'completed'},
    {id:'other',projectId:'q',parentId:null,status:'not_started'},
    {id:'b',projectId:'p',parentId:null,status:'in_progress'},
    {id:'a1',projectId:'p',parentId:'a',status:'not_started'},
    {id:'b2',projectId:'p',parentId:'b',status:'not_started'},
    {id:'c',projectId:'p',parentId:null,status:'completed'}],
  sources:[{id:'s',projectId:'p',taskId:'b1'}], sourceVersions:[{id:'sv',sourceId:'s'}],
  checks:[{id:'check',taskId:'b1',sourceVersionId:'sv'}],
  checkResults:[{id:'result',checkId:'check'}],reviews:[{id:'review',checkId:'check'}]};
  state=normalizeState(structuredClone(legacy));`);
test('v4 migration retains root and child order', `state.schemaVersion===5 &&
  getSiblingTasks('p').map(t=>t.id).join(',')==='a,b,c' &&
  getChildren('b').map(t=>t.id).join(',')==='b1,b2' && getSiblingTasks('q')[0].sortOrder===0`);
test('v4 migration retains all historical records', `['projects','sources','sourceVersions','checks','checkResults','reviews'].every(key=>JSON.stringify(state[key])===JSON.stringify(legacy[key]))`);
test('root move leaves domain and descendants unchanged', `var previous=JSON.stringify(state);
  moveTask('b','up'); var before=JSON.parse(previous);var after=JSON.parse(JSON.stringify(state));
  before.tasks.forEach(t=>delete t.sortOrder);after.tasks.forEach(t=>delete t.sortOrder);
  JSON.stringify(before)===JSON.stringify(after) && getSiblingTasks('p').map(t=>t.id).join(',')==='b,a,c'`);
test('preorder moves the complete subtree', `getProjectTasksInTreeOrder('p').map(t=>t.id).join(',')==='b,b1,b2,a,a1,c'`);
test('child movement stays in parent and project', `moveTask('b2','up');
  getChildren('b').map(t=>t.id).join(',')==='b2,b1' && getChildren('a')[0].id==='a1' && getSiblingTasks('q')[0].id==='other'`);
const writesBeforeBoundary = writes;
test('boundary is a no-op', `var previous=JSON.stringify(state);!moveTask('b','up')&&!moveTask('c','down')&&JSON.stringify(state)===previous`);
assert.equal(writes, writesBeforeBoundary, 'boundary does not write storage');
test('invalid directions and missing tasks cannot mutate', `var previous=JSON.stringify(state);var blocked=0;
  try{moveTask('b','left')}catch{blocked++}try{moveTask('missing','down')}catch{blocked++}
  blocked===2&&JSON.stringify(state)===previous`);
test('move persists across reload', `saveState();state=loadState();getSiblingTasks('p').map(t=>t.id).join(',')==='b,a,c'&&getChildren('b').map(t=>t.id).join(',')==='b2,b1'`);
test('v5 normalization is idempotent and keeps reordered state', `var previous=JSON.stringify(state);normalizeState(state);JSON.stringify(state)===previous`);
test('new root appends to existing order', `var added=createTask({projectId:'p',name:'New'});getSiblingTasks('p').at(-1).id===added.id`);
test('new child appends within its own parent', `var addedChild=createTask({projectId:'p',parentId:'b',name:'New child'});getChildren('b').at(-1).id===addedChild.id && getChildren('a').length===1`);
test('deletion gaps do not produce duplicate append order', `deleteTask('a');var last=createTask({projectId:'p',name:'After delete'});var roots=getSiblingTasks('p');roots.at(-1).id===last.id&&new Set(roots.map(t=>t.sortOrder)).size===roots.length`);
test('ordering does not change project progress', `var previous=getTaskStats('p').percent;moveTask('c','up');getTaskStats('p').percent===previous`);
test('v1 empty migration reaches v5', `normalizeState({projects:[],tasks:[]}).schemaVersion===5`);
test('legacy missing parent and explicit null stay same root group', `var normalized=normalizeState({schemaVersion:4, tasks:[{id:'1',projectId:'p'},{id:'2',projectId:'p',parentId:null}]});normalized.tasks.map(t=>t.sortOrder).join(',')==='0,1'`);
test('arbitrary insertion uses same persisted sibling order', `reorderTask(last.id,'b','before');var reordered=getSiblingTasks('p');reordered[reordered.findIndex(t=>t.id==='b')-1].id===last.id`);
test('adjacent and self insertion are no-ops', `var previous=JSON.stringify(state);!reorderTask(last.id,'b','before')&&!reorderTask(last.id,last.id,'after')&&JSON.stringify(state)===previous`);
test('cross-parent insertion is rejected without mutation', `var previous=JSON.stringify(state);try{reorderTask('b1','b','before');false}catch{JSON.stringify(state)===previous}`);
test('cross-project insertion is rejected without mutation', `var previous=JSON.stringify(state);try{reorderTask('b','other','after');false}catch{JSON.stringify(state)===previous}`);
test('invalid placement cannot mutate', `var previous=JSON.stringify(state);try{reorderTask('b','c','inside');false}catch{JSON.stringify(state)===previous}`);
console.log(`Passed ${passed} task-order tests`);
