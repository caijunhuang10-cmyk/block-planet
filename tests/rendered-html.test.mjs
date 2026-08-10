import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Blockcraft demo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>方块星球 — 体素生存世界<\/title>/i);
  assert.match(html, /方块星球/);
  assert.match(html, /体素生存世界/);
  assert.match(html, /方块星球启动页面/);
  assert.match(html, /进入单人世界/);
  assert.match(html, /四张特色地图/);
  assert.match(html, /森林 · 湖泊 · 河谷 · 高山 · 沙丘 · 完整生存内容/);
  assert.match(html.replaceAll("<!-- -->", ""), /350 × 350/);
  assert.match(html, /真实三维关卡/);
  assert.match(html, /程序化像素贴图/);
  assert.match(html, /第一人称移动/);
  assert.match(html, /多样生物群系与森林/);
  assert.match(html, /破坏与放置/);
  assert.match(html, /分材质破坏时间与裂纹/);
  assert.match(html, /花朵采集与蜜蜂互动/);
  assert.match(html, /4×4 合成与拆解/);
  assert.match(html, /木镐采石与木剑战斗/);
  assert.match(html, /木质工具耐久度/);
  assert.match(html, /统一可拖拽物品栏/);
  assert.match(html, /重力与碰撞/);
  assert.match(html, /水面缓冲摔落伤害/);
  assert.match(html, /白天、夜晚各 10 分钟/);
  assert.match(html, /东升西落与夜间星空/);
  assert.match(html.replaceAll("<!-- -->", ""), /20 格岩层与基岩/);
  assert.match(html, /地下洞穴 · 铁矿 · 红宝石矿/);
  assert.match(html, /可操作的三维 Minecraft 风格体素世界/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /Your site is taking shape/);
});
