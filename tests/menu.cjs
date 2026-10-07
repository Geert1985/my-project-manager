const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:375,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let acceptDelete=false;page.on('dialog',dialog=>acceptDelete?dialog.accept():dialog.dismiss());
    await page.goto(process.env.PREVIEW_URL||pathToFileURL(path.join(__dirname,'../index.html')).href);
    const ids=await page.evaluate(()=>{const p=createProject({name:'Menu test'});const a=createTask({projectId:p.id,name:'A'});const b=createTask({projectId:p.id,name:'B'});openProject(p.id);return {p:p.id,a:a.id,b:b.id}});
    const key=k=>page.locator(`[data-focus-key="${k}"]`);
    const menu=id=>page.locator(`[role="menu"][data-task-id="${id}"]`);
    const snapshot=()=>page.evaluate(()=>JSON.stringify(state));
    async function add(keyName,name,parent){
      await key(keyName).click();assert.equal(await page.locator('#taskParentId').inputValue(),parent);
      await page.locator('#taskName').fill(name);await page.locator('#taskForm button[value="default"]').click();
      return page.evaluate(name=>state.tasks.find(t=>t.name===name).id,name);
    }
    const first=await add(`add-task-${ids.a}`,'First child',ids.a);
    assert.equal(await key(`add-task-${ids.a}`).count(),0);
    assert.equal(await key(`add-child-bottom-${ids.a}`).evaluate(el=>el===document.activeElement),true);
    await add(`add-child-bottom-${ids.a}`,'Second child',ids.a);
    const grandchild=await add(`add-task-${first}`,'Grandchild',first);
    assert.equal(await key(`add-task-${first}`).count(),0);
    await add(`add-child-bottom-${first}`,'Second grandchild',first);
    assert.equal(await key(`add-task-${grandchild}`).count(),1);
    assert.equal(await page.evaluate(ids=>getChildren(ids.a).length,ids),2);
    assert.equal(await page.evaluate(id=>getChildren(id).length,first),2);
    assert.equal(await key(`drag-${ids.a}`).isVisible(),true);
    assert.equal(await key(`move-down-${ids.a}`).isVisible(),false);
    assert.equal(await key(`add-source-${ids.a}`).isVisible(),false);
    assert.equal(await key(`delete-task-${ids.a}`).isVisible(),false);

    await key(`menu-${ids.a}`).focus();await page.keyboard.press('ArrowDown');
    assert.equal(await key(`menu-${ids.a}`).getAttribute('aria-expanded'),'true');
    assert.equal(await key(`add-source-${ids.a}`).evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await key(`move-down-${ids.a}`).evaluate(el=>el===document.activeElement),true,'disabled up is skipped');
    await page.keyboard.press('End');assert.equal(await key(`delete-task-${ids.a}`).evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Home');assert.equal(await key(`add-source-${ids.a}`).evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Escape');assert.equal(await menu(ids.a).isVisible(),false);
    assert.equal(await key(`menu-${ids.a}`).evaluate(el=>el===document.activeElement),true);
    await key(`menu-${ids.a}`).click();await key(`menu-${ids.b}`).click();
    assert.equal(await page.locator('.task-menu:not([hidden])').count(),1);
    assert.equal(await menu(ids.b).isVisible(),true);
    await page.locator('h2').first().click();assert.equal(await page.locator('.task-menu:not([hidden])').count(),0);
    await key(`menu-${ids.a}`).click();await page.keyboard.press('Tab');
    assert.equal(await menu(ids.a).isVisible(),false);

    for(const width of [320,375,600,1280]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await key(`menu-${ids.b}`).click();
      const box=await menu(ids.b).boundingBox();assert.equal(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=900,true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.keyboard.press('Escape');
    }
    await key(`menu-${ids.b}`).click();await key(`move-up-${ids.b}`).click();
    assert.equal(await menu(ids.b).isVisible(),false);
    assert.equal(await page.evaluate(ids=>getSiblingTasks(ids.p)[0].id,ids),ids.b);
    await key(`menu-${ids.b}`).click();await key(`move-down-${ids.b}`).click();
    await page.reload();await page.evaluate(ids=>openProject(ids.p),ids);
    assert.deepEqual(await page.evaluate(ids=>getSiblingTasks(ids.p).map(t=>t.id),ids),[ids.a,ids.b]);
    assert.equal(await key(`add-task-${ids.a}`).count(),0);

    await key(`menu-${ids.b}`).click();await key(`add-source-${ids.b}`).click();
    assert.equal(await menu(ids.b).isVisible(),false);
    assert.equal(await page.locator('#sourceTaskId').inputValue(),ids.b);
    await page.locator('#sourceTitle').fill('Menu source');await page.locator('#sourceForm button[value="default"]').click();
    assert.equal(await key(`menu-${ids.b}`).evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.evaluate(ids=>getTaskSources(ids.b).length,ids),1);
    const before=await snapshot();
    await key(`menu-${ids.b}`).click();await key(`delete-task-${ids.b}`).click();
    assert.equal(await snapshot(),before,'cancel confirmation preserves all records');
    assert.equal(await menu(ids.b).isVisible(),false);
    acceptDelete=true;await key(`menu-${ids.b}`).click();await key(`delete-task-${ids.b}`).click();
    assert.equal(await page.evaluate(ids=>state.tasks.some(t=>t.id===ids.b),ids),false);
    assert.equal(await page.evaluate(ids=>getTaskSources(ids.b).length,ids),0);
    assert.deepEqual(errors,[]);
    console.log('PASS recursive conditional +, footer, menu keyboard/closing/viewport, reorder, source, delete and reload');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
