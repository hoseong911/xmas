/* ════════════════════════════════════════════════════════════════
   선생님 트리 확인(헤드리스).

   무엇을 보나 — 번호를 맞힌 선생님 화면에서,
     · 트리에 자기 편지만 달린다(기본 보기)
     · 오너먼트를 누르면 가운데에 편지가 뜨고 닫힌다, 남의 것은 안 열린다
     · 새로고침해도 보던 자리를 잃지 않는다(sessionStorage)
     · 트리 전체 보기로 바꾼 선택도 새로고침을 넘어간다
     · teacher.html을 새로 불러도 모아보기로 돌아온다

   Cloud Function은 거치지 않는다 — 가짜 오너먼트(?demo=)와 손으로 심은
   sessionStorage를 쓴다. node --test가 집어가지 않게 test/ 밖에 둔다.

   돌리기:  npm run preview   (다른 창에서)
            npm run check:teacher
   ════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import assert from 'node:assert';

const URL = 'http://127.0.0.1:4173/xmas/tree.html?demo=40';
const IDS = ['demo-001', 'demo-002', 'demo-003', 'demo-004', 'demo-005'];
const SESSION = {
  teacherId: 't1', name: '김호성', ids: IDS, locked: false, count: 5,
  letters: IDS.map((id, i) => ({
    id, ornament: 'ball', studentId: '10101', studentName: '학생' + i,
    body: '선생님 고맙습니다 ' + i, createdAt: 1764000000000,
  })),
};

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });

await page.goto(URL, { waitUntil: 'networkidle2' });
await page.evaluate(s => sessionStorage.setItem('xmas_mine', JSON.stringify(s)), SESSION);
await page.reload({ waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 600));

const hung = () => page.$$eval('.xm-hang', els => els.filter(e => !e.hidden).length);

assert.equal(await hung(), 5, '기본은 내 편지 5통만 걸려야 한다');
assert.equal(await page.$eval('#minebar', e => getComputedStyle(e).display), 'flex', '알림 띠가 보여야 한다');
assert.match(await page.$eval('#mineLabel', e => e.textContent), /김호성 선생님께 온 편지 5통/);
assert.equal(await page.$eval('#mineToggle', e => e.textContent), '트리 전체 보기');

// 하나 눌러 모달
await page.click('.xm-hang.mine');
await new Promise(r => setTimeout(r, 200));
assert.ok(await page.$eval('#letterModal', e => e.open), '모달이 열려야 한다');
assert.match(await page.$eval('#letterCard', e => e.textContent), /선생님 고맙습니다/);
await page.click('#letterClose');
await new Promise(r => setTimeout(r, 200));
assert.equal(await page.$eval('#letterModal', e => e.open), false, '닫기로 닫혀야 한다');

// 새로고침해도 내 편지만 보기가 유지된다
await page.reload({ waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 600));
assert.equal(await hung(), 5, '새로고침 뒤에도 내 편지만');

// 트리 전체 보기로 바꾸면 40통 다 걸리고, 그 선택도 새로고침을 넘긴다
await page.click('#mineToggle');
await new Promise(r => setTimeout(r, 400));
assert.equal(await hung(), 40, '전체 보기에서는 40통');
assert.equal(await page.$eval('#mineToggle', e => e.textContent), '내 편지만 보기');
await page.reload({ waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 600));
assert.equal(await hung(), 40, '전체 보기 선택이 새로고침을 넘어간다');

// 남의 오너먼트를 눌러도 아무 일 없다
await page.click('.xm-hang:not(.mine)');
await new Promise(r => setTimeout(r, 200));
assert.equal(await page.$eval('#letterModal', e => e.open), false, '내 편지가 아니면 안 열린다');

// teacher.html: 같은 탭이면 새로고침해도 번호를 다시 묻지 않고 모아보기로 돌아온다
await page.goto('http://127.0.0.1:4173/xmas/teacher.html', { waitUntil: 'networkidle2' });
await page.evaluate(s => sessionStorage.setItem('xmas_mine', JSON.stringify(s)), SESSION);
await page.reload({ waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 900));
assert.ok(await page.$eval('#stepRead', e => e.classList.contains('on')), '모아보기 화면으로 복구되어야 한다');
assert.equal(await page.$$eval('.xm-letter', els => els.length), 5, '편지 5통이 그대로 떠야 한다');

await browser.close();
console.log('전부 통과');
