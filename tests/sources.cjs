const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const context=await browser.newContext();
    // Verify new-tab links without fetching external website content.
    await context.route('https://example.test/**',route=>route.fulfill({body:'Link test',contentType:'text/html'}));
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(process.env.PREVIEW_URL||pathToFileURL(path.join(__dirname,'../index.html')).href);
    const ids=await page.evaluate(()=>{const p=createProject({name:'Sources'});const t=createTask({projectId:p.id,name:'Task'});openProject(p.id);return {p:p.id,t:t.id}});
    const key=k=>page.locator(`[data-focus-key="${k}"]`);
    const card=id=>page.locator(`[data-source-id="${id}"]`);
    async function add(title,url='',description=''){
      await key(`menu-${ids.t}`).click();await key(`add-source-${ids.t}`).click();
      await page.locator('#sourceTitle').fill(title);await page.locator('#sourceUrl').fill(url);
      await page.locator('#sourceDescription').fill(description);await page.locator('#sourceSubmitButton').click();
      return page.evaluate(title=>state.sources.find(s=>s.title===title).id,title);
    }
    const empty=await add('Without URL');await card(empty).locator('summary').focus();await page.keyboard.press('Space');
    assert.equal(await card(empty).locator('.source-open-link').count(),0);
    assert.equal(await card(empty).locator('.source-metadata').count(),0);
    const url='https://example.test/'+ 'long'.repeat(100);
    const description='Line one <img src=x onerror="alert(1)">\nLine two '+ 'Description'.repeat(100);
    const source=await add('With URL',url,description);await card(source).locator('summary').click();
    assert.equal(await card(source).locator('.source-text').filter({hasText:'Line one'}).textContent(),description);
    assert.equal(await card(source).locator('img').count(),0);
    const link=card(source).locator('.source-open-link');
    assert.equal(await link.getAttribute('href'),url);assert.equal(await link.getAttribute('target'),'_blank');
    assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
    const popupPromise=context.waitForEvent('page');await link.click();const popup=await popupPromise;
    await popup.waitForLoadState();assert.equal(popup.url(),url);assert.equal(await popup.evaluate(()=>window.opener),null);await popup.close();
    await key(`edit-source-${source}`).click();assert.equal(await page.locator('#sourceUrl').isDisabled(),false);
    await page.locator('#sourceAuthor').fill('Author');await page.locator('#sourcePublisher').fill('Publisher');
    await page.locator('#sourceTitle').fill('Edited source');await page.locator('#sourceSubmitButton').click();
    assert.equal(await key(`edit-source-${source}`).evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.evaluate(id=>getSource(id).title,source),'Edited source');
    await key(`add-version-${source}`).click();
    await page.locator('#sourceVersion').fill('1');await page.locator('#sourceVersionFileName').fill('File'+ 'Name'.repeat(40)+'.pdf');
    await page.locator('#sourceVersionFilePath').fill('C:/folder/'+ 'Path'.repeat(50));
    await page.locator('#sourceVersionNotes').fill('Version notes\nSecond line <script>bad()</script>');
    await page.locator('#sourceVersionUrl').fill('https://example.test/version1');await page.locator('#sourceVersionForm button[value="default"]').click();
    const versions=await page.evaluate(id=>{
      const first=getSourceVersions(id)[0];
      const second=createSourceVersion({sourceId:id,version:'2',contentHash:'hash-value',notes:'Separate version'});
      render();return {first:first.id,second:second.id};
    },source);
    assert.equal(await card(source).locator('.source-version-entry').count(),2);
    assert.match(await card(source).innerText(),/Bestandsnaam/);assert.match(await card(source).innerText(),/Bestandspad/);
    assert.match(await card(source).innerText(),/hash-value/);
    assert.equal(await card(source).locator('script').count(),0);
    for(const width of [320,375,600,1280]){
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`source overflow ${width}`);
    }
    const historic=await page.evaluate(({source,ids,versions})=>{
      const protocol=createProtocol({name:'Source check'});createProtocolItem({protocolId:protocol.id,title:'Item'});
      const check=createCheck({taskId:ids.t,sourceVersionId:versions.second,protocolId:protocol.id,protocolVersionId:getActiveProtocolVersion(protocol.id).id});
      updateCheckResult({checkResultId:getCheckResults(check.id)[0].id,status:'pass'});
      const review=createReview({checkId:check.id,reviewer:'Reviewer'});updateReviewStatus({reviewId:review.id,status:'approved'});
      return {check:check.id,review:review.id,snapshot:JSON.stringify([state.sourceVersions,state.checks,state.checkResults,state.reviews])};
    },{source,ids,versions});
    await key(`edit-source-${source}`).click();assert.equal(await page.locator('#sourceUrl').isDisabled(),true);
    await page.locator('#sourceDescription').fill('Current metadata\nUpdated description');await page.locator('#sourceSubmitButton').click();
    assert.equal(await page.evaluate(()=>JSON.stringify([state.sourceVersions,state.checks,state.checkResults,state.reviews])),historic.snapshot);
    assert.equal(await page.evaluate(({source,url})=>{
      const before=JSON.stringify(state);try{updateSourceMetadata(source,{title:'Unsafe',url:'https://example.test/changed'})}catch{return JSON.stringify(state)===before&&getSource(source).url===url}return false;
    },{source,url}),true,'URL lock is enforced by domain function');
    await key(`delete-source-${source}`).click();assert.equal(await page.evaluate(id=>!!getSource(id),source),true);
    await key(`delete-source-${empty}`).click();assert.equal(await page.evaluate(id=>!!getSource(id),empty),false);
    await page.evaluate(id=>openSourceVersion(id),versions.first);
    assert.equal(await page.locator('.source-open-link').getAttribute('href'),'https://example.test/version1');
    assert.match(await page.locator('#app').innerText(),/Version notes/);
    for(const width of [320,1280]){
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'version detail overflow');
    }
    await page.evaluate(id=>openSourceVersion(id),versions.second);
    assert.equal(await page.locator('.source-open-link').getAttribute('href'),url,'historical fallback link is unchanged');
    assert.match(await page.locator('#app').innerText(),/Separate version/);
    await page.evaluate(id=>openCheck(id),historic.check);
    assert.match(await page.locator('#app').innerText(),/approved/);
    assert.equal(await page.evaluate(id=>getReview(id).status,historic.review),'approved');
    await page.reload();await page.evaluate(ids=>openProject(ids.p),ids);
    assert.equal(await page.evaluate(id=>getSource(id).description,source),'Current metadata\nUpdated description');
    assert.equal(await page.evaluate(()=>JSON.stringify([state.sourceVersions,state.checks,state.checkResults,state.reviews])),historic.snapshot);
    const unsafe=await page.evaluate(ids=>{const s=createSource({projectId:ids.p,taskId:ids.t,title:'Unsafe URL',url:'javascript:alert(1)'});render();return s.id},ids);
    await card(unsafe).locator('summary').click();assert.equal(await card(unsafe).locator('a').count(),0);
    assert.equal(await page.evaluate(()=>state.schemaVersion),5);
    assert.deepEqual(errors,[]);
    console.log('PASS source create/edit, URL popup/safety, metadata/versions, long content, history guards, delete, reload and responsive layout');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
