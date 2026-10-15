import { expect, test } from "@playwright/test";
import { expectNoScroll, screenKind, setupDemo, spoken, tap, tapFind } from "./helpers";

test.describe("экран бабушки", () => {
  test.beforeEach(async ({ page }) => {
    await setupDemo(page);
    await tap(page, "btn-start");
  });

  test("простая просьба: тема → плитка → «Так?» → Да → фраза", async ({ page }) => {
    await expectNoScroll(page);
    await tapFind(page, "topic-needs");
    expect(await screenKind(page)).toBe("topic");
    await tapFind(page, "frame-need.toilet");
    expect(await screenKind(page)).toBe("confirm");
    await tap(page, "btn-yes");
    expect(await screenKind(page)).toBe("final");
    await expect(page.getByTestId("final-text")).toHaveText("Мне нужно в туалет.");
    const said = (await spoken(page)).map((s) => s.text);
    expect(said).toContain("Мне нужно в туалет.");
    await expectNoScroll(page);
  });

  test("про человека: Люди → фото → что с ней → фраза с её именем", async ({ page }) => {
    await tapFind(page, "topic-people");
    await tapFind(page, "entity-p.aliya");
    expect(await screenKind(page)).toBe("actions");
    await tapFind(page, "frame-people.call");
    expect(await screenKind(page)).toBe("confirm");
    await tap(page, "btn-yes");
    await expect(page.getByTestId("final-text")).toHaveText("Позвони Алии, пожалуйста.");
  });

  test("боль: тело → зона → сила → фраза", async ({ page }) => {
    await tapFind(page, "topic-health");
    await tapFind(page, "tile-body");
    expect(await screenKind(page)).toBe("body");
    await expectNoScroll(page);
    await tap(page, "zone-body.head");
    expect(await screenKind(page)).toBe("severity");
    await tap(page, "face-5");
    // уточнение или сразу «Так?»
    for (let i = 0; i < 4 && (await screenKind(page)) === "question"; i++) await tap(page, "btn-yes");
    expect(await screenKind(page)).toBe("confirm");
    await tap(page, "btn-yes");
    await expect(page.getByTestId("final-text")).toHaveText("У меня очень сильно болит голова.");
  });

  test("составное сообщение со связкой", async ({ page }) => {
    await tapFind(page, "topic-feelings");
    await tapFind(page, "frame-feel.sad");
    await tap(page, "btn-yes");
    await page.waitForTimeout(4800); // «Ещё что-то?»
    await tap(page, "btn-yes");
    expect(await screenKind(page)).toBe("connective");
    await tap(page, "conn-because");
    await tapFind(page, "topic-people");
    await tapFind(page, "entity-p.aliya");
    await tapFind(page, "frame-feel.miss");
    await tap(page, "btn-yes");
    await expect(page.getByTestId("final-text")).toHaveText("Мне грустно, потому что я скучаю по Алии.");
  });

  test("«Нет» на «Так?» возвращает к плиткам", async ({ page }) => {
    await tapFind(page, "topic-needs");
    await tapFind(page, "frame-need.toilet");
    await tap(page, "btn-no");
    expect(await screenKind(page)).toBe("topic");
  });

  test("Помогите и Сначала доступны всегда", async ({ page }) => {
    await tapFind(page, "topic-needs");
    await tap(page, "btn-help");
    expect(await screenKind(page)).toBe("help");
    await tap(page, "btn-restart");
    expect(await screenKind(page)).toBe("home");
  });

  test("короткое касание и двойное нажатие не срабатывают", async ({ page }) => {
    const box = (await page.getByTestId("topic-needs").boundingBox())!;
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.up(); // ~0 мс
    await page.waitForTimeout(300);
    expect(await screenKind(page)).toBe("home");
    await tapFind(page, "topic-needs");
    expect(await screenKind(page)).toBe("topic");
  });

  test("вход для близких: удержание угла 3 секунды и PIN", async ({ page }) => {
    const vp = page.viewportSize()!;
    // короткое удержание ничего не открывает
    await page.mouse.move(vp.width - 20, 20);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    await page.mouse.up();
    await expect(page.getByTestId("pin-input")).toHaveCount(0);
    await page.mouse.down();
    await page.waitForTimeout(3200);
    await page.mouse.up();
    await page.getByTestId("pin-input").fill("0000");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByText("Неверный PIN")).toBeVisible();
    await page.getByTestId("pin-input").fill("1234");
    await page.getByRole("button", { name: "Войти" }).click();
    await page.waitForURL("**/care/");
    await expect(page.getByText("Настройки для близких")).toBeVisible();
  });

  test("цели не меньше 120×120 и промежутки не меньше 24", async ({ page }) => {
    for (const where of ["home", "topic"]) {
      if (where === "topic") await tapFind(page, "topic-needs");
      const boxes = await page.evaluate(() =>
        [...document.querySelectorAll("[data-press-id]")].map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height, id: el.getAttribute("data-testid") };
        }),
      );
      for (const b of boxes) {
        expect(b.w, `${b.id} ширина`).toBeGreaterThanOrEqual(119.5);
        expect(b.h, `${b.id} высота`).toBeGreaterThanOrEqual(119.5);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!;
          const c = boxes[j]!;
          const dx = Math.max(c.x - (a.x + a.w), a.x - (c.x + c.w));
          const dy = Math.max(c.y - (a.y + a.h), a.y - (c.y + c.h));
          expect(Math.max(dx, dy), `${a.id} и ${c.id}`).toBeGreaterThanOrEqual(23.5);
        }
      }
    }
  });
});
