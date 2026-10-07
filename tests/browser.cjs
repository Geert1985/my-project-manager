// Requires Playwright and an installed Edge browser. Uses disposable browser data.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(process.env.PREVIEW_URL || pathToFileURL(path.join(__dirname, '../index.html')).href);
    const ids = await page.evaluate(() => {
      const project = createProject({ name: 'Browser audit' });
      const parent = createTask({ projectId: project.id, name: 'Parent ' + 'Lang'.repeat(30) });
      for (let i = 0; i < 10; i++) createTask({ projectId: project.id, name: 'Root ' + i });
      const child = createTask({ projectId: project.id, parentId: parent.id, name: 'Child ' + 'Naam'.repeat(30) });
      const leaf = createTask({ projectId: project.id, parentId: child.id, name: 'Leaf ' + 'Naam'.repeat(30) });
      createTask({ projectId: project.id, parentId: parent.id, name: 'Second child' });
      const source = createSource({ projectId: project.id, taskId: leaf.id, title: 'Source ' + 'Titel'.repeat(30) });
      createSourceVersion({ sourceId: source.id, version: '1' });
      openProject(project.id);
      return { project: project.id, parent: parent.id, child: child.id, leaf: leaf.id, source: source.id };
    });
    for (const width of [320, 375, 600, 601, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `overflow at ${width}px`);
    }
    await page.setViewportSize({ width: 375, height: 900 });
    const parentToggle = page.locator(`[data-focus-key="collapse-${ids.parent}"]`);
    const childToggle = page.locator(`[data-focus-key="collapse-${ids.child}"]`);
    await childToggle.click();
    await parentToggle.click();
    const checkbox = page.locator(`[data-focus-key="task-${ids.parent}"]`);
    await checkbox.focus();
    await page.keyboard.press('Space');
    assert.equal(await parentToggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await checkbox.evaluate(element => element === document.activeElement), true);
    await parentToggle.click();
    assert.equal(await childToggle.getAttribute('aria-expanded'), 'false');
    await childToggle.click();
    assert.match(await page.locator('.task-name').first().innerText(), /2 subtaken/);

    // Adding a task keeps the collapsed parent and returns focus to its action.
    await parentToggle.click();
    const addTask = page.locator(`[data-focus-key="add-task-${ids.parent}"]`);
    await addTask.click();
    await page.locator('#taskName').fill('Added from dialog');
    await page.locator('#taskForm button[value="default"]').click();
    assert.equal(await parentToggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await addTask.evaluate(element => element === document.activeElement), true);
    assert.match(await page.locator('.task-name').first().innerText(), /3 subtaken/);

    await parentToggle.click();
    const sourceCard = page.locator(`[data-source-id="${ids.source}"]`);
    await sourceCard.locator('summary').click();
    // Move a parent with its subtree and preserve its collapsed state.
    await parentToggle.click();
    const down = page.locator(`[data-focus-key="move-down-${ids.parent}"]`);
    await down.focus();
    await page.keyboard.press('Enter');
    assert.equal(await parentToggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await down.evaluate(element => element === document.activeElement), true);
    assert.equal(await page.evaluate(ids => getSiblingTasks(ids.project)[1].id, ids), ids.parent);
    const up = page.locator(`[data-focus-key="move-up-${ids.parent}"]`);
    await up.click();
    assert.equal(await up.isDisabled(), true);
    assert.equal(await checkbox.evaluate(element => element === document.activeElement), true);
    await parentToggle.click();
    const leafDown = page.locator(`[data-focus-key="move-down-${ids.leaf}"]`);
    assert.equal(await leafDown.isDisabled(), true);
    const extraChild = await page.evaluate(ids => {
      const extra = createTask({projectId:ids.project,parentId:ids.child,name:'Order sibling'});
      render(); return extra.id;
    }, ids);
    await leafDown.click();
    assert.deepEqual(await page.evaluate(ids => getChildren(ids.child).map(t=>t.id), ids), [extraChild, ids.leaf]);
    await page.reload();
    await page.evaluate(ids => openProject(ids.project), ids);
    assert.deepEqual(await page.evaluate(ids => getChildren(ids.child).map(t=>t.id), ids), [extraChild, ids.leaf]);
    await sourceCard.locator('summary').click();
    const addVersion = page.locator(`[data-focus-key="add-version-${ids.source}"]`);
    await addVersion.click();
    await page.locator('#sourceVersion').fill('2');
    await page.locator('#sourceVersionForm button[value="default"]').click();
    assert.equal(await sourceCard.getAttribute('open') !== null, true);
    assert.equal(await addVersion.evaluate(element => element === document.activeElement), true);

    // A rejected deletion is handled by the UI without modifying any records.
    const snapshot = await page.evaluate(ids => {
      const protocol = createProtocol({ name: 'Audit protocol' });
      createProtocolItem({ protocolId: protocol.id, title: 'Audit item' });
      createCheck({ taskId: ids.leaf, sourceVersionId: getSourceVersions(ids.source)[0].id,
        protocolId: protocol.id, protocolVersionId: getActiveProtocolVersion(protocol.id).id });
      return JSON.stringify(state);
    }, ids);
    await page.locator(`[data-focus-key="delete-task-${ids.parent}"]`).click();
    assert.equal(await page.evaluate(() => JSON.stringify(state)), snapshot);
    await page.locator(`[data-focus-key="delete-source-${ids.source}"]`).click();
    assert.equal(await page.evaluate(() => JSON.stringify(state)), snapshot);
    await page.evaluate(ids => removeProject(ids.project), ids);
    assert.equal(await page.evaluate(() => JSON.stringify(state)), snapshot);

    await page.evaluate(() => {
      state.checks = ['approved', 'pending', 'failed', 'completed'].map((key, i) => ({
        id: 'c' + i, taskId: state.tasks[0].id, status: key === 'failed' ? 'failed' : 'passed',
        createdAt: new Date().toISOString()
      }));
      state.reviews = ['approved', 'pending'].map((status, i) => ({
        id: 'r' + i, checkId: 'c' + i, status, reviewer: 'Reviewer', createdAt: new Date().toISOString()
      }));
      currentView = 'controls'; render();
    });
    for (const key of ['approved', 'pending', 'failed', 'completed']) {
      const button = page.locator(`[data-focus-key="filter-${key}"]`);
      await button.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#app > .card').nth(1).locator('.control-row').count(), 1);
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await button.evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#app > .card').nth(1).locator('.control-row').count(), 4);
      assert.equal(await button.getAttribute('aria-pressed'), 'false');
      assert.equal(await button.evaluate(element => element === document.activeElement), true);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS browser regressions; Edge ${browser.version()}; viewports 320–1280px`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
