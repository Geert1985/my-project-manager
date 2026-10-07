const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'..');
const el={innerHTML:'',addEventListener(){},querySelectorAll(){return []},querySelector(){return null}};
const ctx=vm.createContext({console,crypto:require('crypto').webcrypto,structuredClone,localStorage:{getItem(){return null},setItem(){}},document:{getElementById(){return el},querySelectorAll(){return []},addEventListener(){}},window:{addEventListener(){}}});
for(const f of ['storage','tasks','projects','sources','protocols','checks','reviews','interchange','app','task-drag','task-menu','interchange-ui']){new vm.Script(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),{filename:f}).runInContext(ctx)}
const run=s=>vm.runInContext(s,ctx);let passed=0;
function test(name,s){try{assert.equal(run(s),true);console.log('PASS '+name);passed++}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}}
run(`var p=createProject({name:'P'});var a=createTask({projectId:p.id,name:'A'});var b=createTask({projectId:p.id,parentId:a.id,name:'B'});var c=createTask({projectId:p.id,parentId:a.id,name:'C'});`);
test('matrix 1',`a.status==='not_started'`);
test('matrix 2',`setTaskCompleted(b.id,true);a.status==='in_progress'`);
test('matrix 3',`setTaskCompleted(c.id,true);a.status==='completed'&&a.completionMode==='automatic'`);
test('matrix 4',`setTaskCompleted(b.id,false);a.status==='in_progress'`);
test('matrix 5',`setTaskCompleted(a.id,true);[a,b,c].every(t=>t.status==='completed'&&t.completionMode==='manual')`);
test('matrix 6',`setTaskCompleted(b.id,false);a.status==='completed'`);
test('matrix 7 partial',`setTaskCompleted(a.id,false);a.status==='in_progress'`);
test('matrix 7 all children completed',`setTaskCompleted(a.id,true);setTaskCompleted(a.id,false);a.status==='in_progress'`);
test('matrix 8',`var d=createTask({projectId:p.id,parentId:a.id,name:'D'});a.status==='in_progress'&&d.status==='not_started'`);
test('matrix 9',`var x=createTask({projectId:p.id,name:'X'});var y=createTask({projectId:p.id,parentId:x.id,name:'Y'});setTaskCompleted(x.id,true);deleteTask(y.id);x.status==='completed'`);
test('matrix 10',`setTaskCompleted(b.id,true);deleteTask(d.id);a.status==='completed'`);
test('matrix 11',`var e=createTask({projectId:p.id,parentId:b.id,name:'E'});setTaskCompleted(a.id,false);setTaskCompleted(e.id,true);a.status==='completed'`);
test('matrix 12',`getTaskStats('empty').percent===0`);
test('matrix 13',`setTaskCompleted(a.id,true);getTaskStats(p.id).percent===100`);
test('matrix 14',`setTaskCompleted(x.id,false);var stats=getTaskStats(p.id);stats.percent===Math.round(stats.completed/stats.total*100)`);
run(`var src=createSource({projectId:p.id,taskId:a.id,title:'S'});var sv=createSourceVersion({sourceId:src.id,version:'1'});var pr=createProtocol({name:'Protocol'});var pv=getActiveProtocolVersion(pr.id);var item=createProtocolItem({protocolId:pr.id,title:'Item'});var ch=createCheck({taskId:a.id,sourceVersionId:sv.id,protocolId:pr.id,protocolVersionId:pv.id});`);
test('source deletion blocks even unstarted check',`!getSourceDeletionState(src.id).allowed`);
test('source deletion guard no mutation',`var snapshot=JSON.stringify(state);try{deleteSource(src.id)}catch{}JSON.stringify(state)===snapshot`);
test('unused source deletes versions only',`var unused=createSource({projectId:p.id,taskId:a.id,title:'unused'});createSourceVersion({sourceId:unused.id,version:'1'});deleteSource(unused.id);!getSource(unused.id)&&!state.sourceVersions.some(v=>v.sourceId===unused.id)&&!!getSourceVersion(sv.id)`);
test('used protocol version locked',`try{createProtocolItem({protocolId:pr.id,title:'bad'});false}catch{true}`);
test('historical version copy and activation',`var pv2=createProtocolVersion({protocolId:pr.id,version:'2',copyFromVersionId:pv.id});activateProtocolVersion(pv2.id);ch.protocolVersionId===pv.id&&pv.status==='retired'&&getProtocolItemsForVersion(pv2.id)[0].id!==item.id`);
test('review immutable',`updateCheckResult({checkResultId:getCheckResults(ch.id)[0].id,status:'pass'});var rev=createReview({checkId:ch.id,reviewer:'R'});updateReviewStatus({reviewId:rev.id,status:'approved'});try{updateReviewStatus({reviewId:rev.id,status:'rejected'});false}catch{true}`);
test('dashboard states',`getCheckDisplayState(ch).key==='approved'&&getCheckDisplayState({id:'f',status:'failed'}).key==='failed'&&getCheckDisplayState({id:'p',status:'passed'}).key==='completed'`);
test('filter toggle',`setControlFilter('approved');var ok=activeControlFilter==='approved';setControlFilter('approved');ok&&activeControlFilter===null`);
test('migration preserves and is idempotent',`var old={schemaVersion:3,protocols:[{id:'old',version:'1'}],protocolItems:[{id:'i',protocolId:'old'}],checks:[{id:'c',protocolId:'old'}],reviews:[{id:'r',checkId:'c'}],checkResults:[{id:'cr',checkId:'c'}]};var migrated=normalizeState(old);var once=JSON.stringify(migrated);normalizeState(migrated);JSON.stringify(migrated)===once&&migrated.schemaVersion===5&&migrated.checks[0].protocolVersionId===migrated.protocolItems[0].protocolVersionId&&migrated.reviews.length===1&&migrated.checkResults.length===1`);
test('task deletion historical integrity',`var before=JSON.stringify(state);try{deleteTask(a.id);false}catch{JSON.stringify(state)===before}`);
test('project deletion historical integrity',`var before=JSON.stringify(state);try{deleteProject(p.id);false}catch{JSON.stringify(state)===before}`);

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);const refs=[...fs.readFileSync(path.join(root,'js/app.js'),'utf8').matchAll(/getElementById\("([^"]+)"\)/g)].map(m=>m[1]);console.log('Missing HTML IDs',refs.filter(id=>!ids.includes(id)));console.log('Duplicate HTML IDs',ids.filter((id,i)=>ids.indexOf(id)!==i));

test('ancestor deletion protects checked descendant',`var outer=createTask({projectId:p.id,name:'Outer'});a.parentId=outer.id;var before=JSON.stringify(state);try{deleteTask(outer.id);false}catch{JSON.stringify(state)===before}`);
test('source-version check protects task with inconsistent check.taskId',`var originalTaskId=ch.taskId;ch.taskId='missing';var before=JSON.stringify(state);var blocked=false;try{deleteTask(a.id)}catch{blocked=JSON.stringify(state)===before}ch.taskId=originalTaskId;blocked`);
test('unused task deletion cleans sources and versions, preserves other project',`var other=createProject({name:'Other'});var clean=createTask({projectId:other.id,name:'Clean'});var child=createTask({projectId:other.id,parentId:clean.id,name:'Child'});var cleanSource=createSource({projectId:other.id,taskId:child.id,title:'clean'});var cleanVersion=createSourceVersion({sourceId:cleanSource.id,version:'1'});deleteTask(clean.id);!state.tasks.some(t=>t.id===clean.id||t.id===child.id)&&!getSource(cleanSource.id)&&!getSourceVersion(cleanVersion.id)&&!!getCheck(ch.id)`);
test('unused project deletion cleans unattached sources',`var free=createSource({projectId:other.id,title:'free'});var freeVersion=createSourceVersion({sourceId:free.id,version:'1'});deleteProject(other.id);!getProject(other.id)&&!getSource(free.id)&&!getSourceVersion(freeVersion.id)&&!!getProject(p.id)&&!!getCheck(ch.id)`);
test('failed check cannot be approved',`var failed=createCheck({taskId:a.id,sourceVersionId:sv.id,protocolId:pr.id,protocolVersionId:pv2.id});updateCheckResult({checkResultId:getCheckResults(failed.id)[0].id,status:'fail'});var failedReview=createReview({checkId:failed.id,reviewer:'R'});try{updateReviewStatus({reviewId:failedReview.id,status:'approved'});false}catch{failedReview.status==='pending'}`);
test('parent reopen persists through reload',`setTaskCompleted(a.id,true);setTaskCompleted(a.id,false);var loaded=normalizeState(JSON.parse(JSON.stringify(state)));loaded.tasks.find(t=>t.id===a.id).status==='in_progress'`);

test('matrix 8 first child reopens completed leaf',`var leafParent=createTask({projectId:p.id,name:'Completed leaf'});setTaskCompleted(leafParent.id,true);var firstChild=createTask({projectId:p.id,parentId:leafParent.id,name:'New work'});leafParent.status==='in_progress'&&firstChild.status==='not_started'`);
test('matrix 4 reopening only child starts automatic parent',`setTaskCompleted(firstChild.id,true);var automatic=leafParent.completionMode==='automatic';setTaskCompleted(firstChild.id,false);automatic&&leafParent.status==='in_progress'&&leafParent.completionMode==='automatic'`);
console.log('Passed '+passed+' domain tests');
assert.deepEqual(refs.filter(id=>!ids.includes(id)), []);
assert.deepEqual(ids.filter((id,i)=>ids.indexOf(id)!==i), []);
