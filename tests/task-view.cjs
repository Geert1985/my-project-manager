const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:375,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.PREVIEW_URL||pathToFileURL(path.join(__dirname,'../index.html')).href);
  const ids=await page.evaluate(()=>{
   const p=createProject({name:'View controls'}),other=createProject({name:'Other project'});
   const make=(name,priority,parentId=null,description='')=>createTask({projectId:p.id,name,priority,parentId,description});
   const low=make('Root low','low',null,'Description'),normal=make('Root normal','normal');
   const high1=make('Root high 1','high'),high2=make('Root high 2','high');
   const leaf=make('Leaf without details','normal');
   const childLow=make('Child low','low',normal.id),childHigh=make('Child high','high',normal.id),childNormal=make('Child normal','normal',normal.id),childHigh2=make('Child high 2','high',normal.id);
   const deep=make('Deep','low',childLow.id),deeper=make('Deeper','normal',deep.id,'Details');
   const otherTask=createTask({projectId:other.id,name:'Other',description:'Other details'});collapsedTaskIds.add(otherTask.id);
   moveTask(high2.id,'up');moveTask(childHigh2.id,'up');moveTask(childHigh2.id,'up');
   setTaskCompleted(childHigh.id,true);openProject(p.id);
   return {p:p.id,normal:normal.id,low:low.id,high1:high1.id,high2:high2.id,childLow:childLow.id,childHigh:childHigh.id,childNormal:childNormal.id,childHigh2:childHigh2.id,deep:deep.id,deeper:deeper.id,otherTask:otherTask.id};
  });
  const before=await page.evaluate(()=>JSON.stringify(state));
  const stored=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));
  const manual=await page.evaluate(id=>getSiblingTasks(id).map(t=>t.id),ids.p);
  const childManual=await page.evaluate(id=>getChildren(id).map(t=>t.id),ids.normal);
  const select=page.locator('[data-focus-key="task-sort-view"]'),all=page.locator('[data-collapse-all]');
  const toggle=id=>page.locator(`[data-focus-key="collapse-${id}"]`);
  const rendered=parentId=>page.evaluate(parent=>{
   const container=parent?document.querySelector(`[data-task-header="${parent}"]`).closest('.task-row').querySelector(':scope > .task-content > .task-details > .children'):document.querySelector('.task-section-header').parentElement.querySelector(':scope > div:not(.task-section-header):not(.task-list-footer)');
   return [...container.querySelectorAll(':scope > .task-row > .task-content > .task-header')].map(el=>el.dataset.taskHeader);
  },parentId);
  await all.click();assert.equal(await all.textContent(),'Alles uitklappen');
  assert.equal(await page.locator('.task-toggle[aria-expanded="true"]').count(),0);
  assert.equal(await page.evaluate(id=>collapsedTaskIds.has(id),ids.otherTask),true);
  await toggle(ids.normal).click();assert.equal(await all.textContent(),'Alles inklappen');
  await toggle(ids.normal).click();assert.equal(await all.textContent(),'Alles uitklappen');
  await all.click();assert.equal(await page.locator('.task-toggle[aria-expanded="false"]').count(),0);
  assert.equal(await toggle(ids.deeper).getAttribute('aria-expanded'),'true');
  await toggle(ids.deep).click();assert.equal(await toggle(ids.deep).getAttribute('aria-expanded'),'false');
  await toggle(ids.deep).click();
  await select.selectOption('priority');
  assert.deepEqual(await rendered(null),[ids.high2,ids.high1,ids.normal,manual.at(-1),ids.low]);
  assert.deepEqual(await rendered(ids.normal),[ids.childHigh2,ids.childHigh,ids.childNormal,ids.childLow]);
  assert.equal(await page.locator('.task-drag-handle:not(:disabled)').count(),0);
  assert.equal(await page.locator('[data-focus-key^="move-up-"]:not(:disabled),[data-focus-key^="move-down-"]:not(:disabled)').count(),0);
  assert.match(await page.locator('.task-reorder-note').textContent(),/Schakel over naar handmatige/);
  await page.evaluate(ids=>moveTaskFromUi(ids.low,'up'),ids);
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),stored);
  for(const width of [320,375,1280]){
   await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await all.isVisible(),true);assert.equal(await select.isVisible(),true);
  }
  await select.selectOption('manual');assert.deepEqual(await rendered(null),manual);assert.deepEqual(await rendered(ids.normal),childManual);
  assert.equal(await page.locator(`[data-focus-key="drag-${ids.low}"]`).isEnabled(),true);
  await page.locator(`[data-focus-key="menu-${ids.high1}"]`).click();await page.locator(`[data-focus-key="move-up-${ids.high1}"]`).click();
  await all.click();
  const drag=page.locator(`[data-focus-key="drag-${ids.high1}"]`);
  await drag.scrollIntoViewIfNeeded();
  const from=await drag.boundingBox(),to=await page.locator(`[data-task-header="${ids.low}"]`).boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
  await page.mouse.move(to.x+to.width/2,to.y+to.height*.2,{steps:8});await page.mouse.up();
  const moved=await page.evaluate(id=>getSiblingTasks(id).map(t=>t.id),ids.p);
  assert.equal(moved[0],ids.high1,'actual drag order is retained through view changes');
  await select.selectOption('priority');await select.selectOption('manual');assert.deepEqual(await rendered(null),moved);
  await page.reload();await page.evaluate(id=>openProject(id),ids.p);
  assert.equal(await select.inputValue(),'manual');assert.deepEqual(await rendered(null),moved);
  assert.equal(await page.evaluate(()=>state.schemaVersion),5);
  const empty=await page.evaluate(()=>{const p=createProject({name:'Empty'});openProject(p.id);return p.id});
  assert.equal(await all.isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS recursive collapse/individual toggles, stable per-parent priority view, unchanged data/storage, reorder guard, manual restoration/reload and 320/375/desktop');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
