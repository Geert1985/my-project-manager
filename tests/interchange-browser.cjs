const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});let downloadedPath;
 try{
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:375,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const alerts=[];page.on('dialog',async dialog=>{alerts.push(dialog.message());await dialog.accept()});
  await page.goto(process.env.PREVIEW_URL||pathToFileURL(path.join(__dirname,'../index.html')).href);
  const data={format:'my-projects',formatVersion:1,project:{name:'AI checklist <img src=x>',tasks:[{name:'A',children:[{name:'Child'}]},{name:'B',status:'completed'}]}};
  await page.locator('[onclick="chooseProjectImport()"]').click({trial:true});
  const chooserPromise=page.waitForEvent('filechooser');await page.locator('[onclick="chooseProjectImport()"]').click();
  const chooser=await chooserPromise;await chooser.setFiles({name:'ai-checklist.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.waitForFunction(()=>state.projects.length===1);
  assert.equal(await page.locator('#app img').count(),0);
  const first=await page.evaluate(()=>state.projects[0].id);
  const downloadPromise=page.waitForEvent('download');await page.locator('[onclick^="downloadProject("]').click();const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/^my-projects-ai-checklist-img-src-x\.json$/);
  downloadedPath=await download.path();const exported=JSON.parse(await fs.readFile(downloadedPath,'utf8'));
  assert.equal(exported.format,'my-projects');assert.equal(exported.project.tasks[0].children[0].name,'Child');
  for(let i=0;i<2;i++){
   await page.locator('#projectImportFile').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
   await page.waitForFunction(expected=>state.projects.length===expected,i+2);
  }
  assert.equal(await page.evaluate(()=>new Set(state.projects.map(p=>p.id)).size),3);
  assert.equal(await page.evaluate(id=>JSON.stringify(exportProjectFile(id).project),first),JSON.stringify(exported.project));
  const beforeInvalid=await page.evaluate(()=>JSON.stringify(state));
  for(const [name,value] of [['invalid.json','{'],['wrong.json',JSON.stringify({...data,format:'other'})],['future.json',JSON.stringify({...data,formatVersion:9})],['missing.json',JSON.stringify({format:'my-projects',formatVersion:1,project:{tasks:[]}})]]){
   const alertCount=alerts.length;
   await page.locator('#projectImportFile').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(value)});
   await page.waitForFunction(()=>!projectImportBusy);
   assert.equal(alerts.length,alertCount+1);assert.match(alerts.at(-1),/Projectbestand/);
   assert.equal(await page.evaluate(()=>JSON.stringify(state)),beforeInvalid);
  }
  await page.reload();assert.equal(await page.evaluate(()=>state.projects.length),3);
  await page.evaluate(id=>openProject(id),first);assert.equal(await page.evaluate(id=>getSiblingTasks(id)[1].status,first),'completed');
  for(const width of [320,375,600,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
  await page.evaluate(()=>{const p=importProjectFile({format:'my-projects',formatVersion:1,project:{name:'N'.repeat(200),description:'D'.repeat(1000),tasks:[{name:'T'.repeat(200),description:'x'.repeat(1000)}]}});openProject(p.id)});
  await page.setViewportSize({width:320,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'long imported fields wrap');
  assert.deepEqual(errors,[]);
  console.log('PASS chooser/download, AI checklist, duplicate import, rejected files, escaping, unchanged original, refresh and responsive UI');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
