const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const context = await browser.newContext({ viewport:{width:375,height:900}, hasTouch:true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.PREVIEW_URL || pathToFileURL(path.join(__dirname,'../index.html')).href);
    const ids = await page.evaluate(() => {
      const p=createProject({name:'Drag audit'});
      const roots=['A','B','C'].map(name=>createTask({projectId:p.id,name}));
      const children=['Child 1','Child 2'].map(name=>createTask({projectId:p.id,parentId:roots[0].id,name}));
      createTask({projectId:p.id,parentId:children[0].id,name:'Grandchild'});
      collapsedTaskIds.add(roots[0].id);openProject(p.id);
      window.reorderCalls=0;const original=reorderTask;
      reorderTask=(...args)=>{window.reorderCalls++;return original(...args)};
      return {p:p.id,roots:roots.map(t=>t.id),children:children.map(t=>t.id)};
    });
    const handle = id => page.locator(`[data-focus-key="drag-${id}"]`);
    const header = id => page.locator(`[data-task-header="${id}"]`);
    const order = () => page.evaluate(ids=>getSiblingTasks(ids.p).map(t=>t.id),ids);
    const snapshot = () => page.evaluate(()=>JSON.stringify(state));
    async function mouseStart(id) {
      await handle(id).scrollIntoViewIfNeeded();
      const r=await handle(id).boundingBox();
      await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
    }
    async function mouseTarget(id,placement) {
      const r=await header(id).boundingBox();
      await page.mouse.move(r.x+r.width/2,r.y+r.height*(placement==='before'?.2:.8),{steps:8});
    }
    const initial=await snapshot();
    await mouseStart(ids.roots[2]);await mouseTarget(ids.roots[0],'before');
    assert.equal(await snapshot(),initial,'pointer movement does not persist a provisional order');
    assert.equal(await header(ids.roots[0]).evaluate(el=>el.classList.contains('task-drop-before')),true);
    await page.mouse.up();
    assert.deepEqual(await order(),[ids.roots[2],ids.roots[0],ids.roots[1]]);
    assert.equal(await page.evaluate(()=>window.reorderCalls),1);
    assert.equal(await page.locator(`[data-focus-key="collapse-${ids.roots[0]}"]`).getAttribute('aria-expanded'),'false');
    assert.equal(await handle(ids.roots[2]).evaluate(el=>el===document.activeElement),true);

    // Arrow and mouse drop both reach the same reorderTask function.
    await page.locator(`[data-focus-key="move-down-${ids.roots[2]}"]`).click();
    assert.equal(await page.evaluate(()=>window.reorderCalls),2);
    assert.deepEqual(await order(),[ids.roots[0],ids.roots[2],ids.roots[1]]);
    await page.locator(`[data-focus-key="move-down-${ids.roots[2]}"]`).click();
    assert.deepEqual(await order(),ids.roots);
    await mouseStart(ids.roots[0]);await mouseTarget(ids.roots[2],'after');await page.mouse.up();
    assert.deepEqual(await order(),[ids.roots[1],ids.roots[2],ids.roots[0]]);

    // Genuine touch events are translated to the same Pointer Events handlers.
    const session=await context.newCDPSession(page);
    const from=await handle(ids.roots[0]).boundingBox(),to=await header(ids.roots[1]).boundingBox();
    const touch=(x,y)=>[{x,y,id:1}];
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touch(from.x+from.width/2,from.y+from.height/2)});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touch(to.x+to.width/2,to.y+to.height*.2)});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.deepEqual(await order(),ids.roots);
    assert.equal(await page.evaluate(()=>window.reorderCalls),5);
    const beforeCancel=await snapshot();
    const cancelFrom=await handle(ids.roots[2]).boundingBox(),cancelTo=await header(ids.roots[0]).boundingBox();
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touch(cancelFrom.x+cancelFrom.width/2,cancelFrom.y+cancelFrom.height/2)});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touch(cancelTo.x+cancelTo.width/2,cancelTo.y+cancelTo.height*.2)});
    await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.equal(await snapshot(),beforeCancel);
    assert.equal(await page.locator('.task-drop-before,.task-drop-after,.dragging').count(),0);

    // Parent/child boundaries, cancellation and releases outside a header are inert.
    await page.locator(`[data-focus-key="collapse-${ids.roots[0]}"]`).click();
    const beforeInvalid=await snapshot();
    await mouseStart(ids.children[0]);await mouseTarget(ids.roots[1],'before');await page.mouse.up();
    assert.equal(await snapshot(),beforeInvalid);
    await mouseStart(ids.roots[2]);await mouseTarget(ids.roots[0],'before');
    await page.keyboard.press('Escape');await page.mouse.up();
    assert.equal(await snapshot(),beforeInvalid);
    await mouseStart(ids.roots[2]);await page.mouse.move(2,200,{steps:5});await page.mouse.up();
    assert.equal(await snapshot(),beforeInvalid);
    await mouseStart(ids.children[1]);await mouseTarget(ids.children[0],'before');await page.mouse.up();
    assert.deepEqual(await page.evaluate(ids=>getChildren(ids.roots[0]).map(t=>t.id),ids),[ids.children[1],ids.children[0]]);
    await page.reload();await page.evaluate(ids=>openProject(ids.p),ids);
    assert.deepEqual(await order(),ids.roots);
    assert.deepEqual(await page.evaluate(ids=>getChildren(ids.roots[0]).map(t=>t.id),ids),[ids.children[1],ids.children[0]]);

    // Edge scrolling is transient; cancelling it does not write task data.
    await page.evaluate(ids=>{for(let i=0;i<30;i++)createTask({projectId:ids.p,name:'Scroll '+i});render()},ids);
    await page.evaluate(()=>window.scrollTo(0,0));
    const beforeScroll=await snapshot();
    await mouseStart(ids.roots[0]);await page.mouse.move(150,880,{steps:8});
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>scrollY>0),true);
    await page.keyboard.press('Escape');await page.mouse.up();
    assert.equal(await snapshot(),beforeScroll);
    assert.equal(await page.locator('.task-drop-before,.task-drop-after,.dragging').count(),0);
    assert.deepEqual(errors,[]);
    console.log(`PASS mouse/touch drag, shared reorder, boundaries, cancellation, reload and edge scroll; Edge ${browser.version()}`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
