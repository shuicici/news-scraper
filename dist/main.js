"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apify_1 = require("apify");
const crawlee_1 = require("crawlee");
async function main() {
    await apify_1.Actor.init();
    const input = await apify_1.Actor.getInput();
    if (!input?.source)
        throw new Error('Source required');
    const urls = {
        'google-news': 'https://news.google.com',
        'bbc': 'https://www.bbc.com/news',
        'reuters': 'https://www.reuters.com'
    };
    const url = input.query
        ? `${urls[input.source]}/search?q=${encodeURIComponent(input.query)}`
        : urls[input.source];
    const crawler = new crawlee_1.PlaywrightCrawler({
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 90,
        requestHandler: async ({ page }) => {
            await page.waitForTimeout(3000);
            const articles = await page.evaluate(() => {
                const items = [];
                const selectors = [
                    'article', '.article', '.news-item',
                    'google-news .article', 'main article'
                ];
                for (const sel of selectors) {
                    const els = document.querySelectorAll(sel);
                    if (els.length > 0) {
                        els.forEach((el) => {
                            const title = el.querySelector('h1, h2, h3, a')?.textContent?.trim();
                            const link = el.querySelector('a')?.getAttribute('href');
                            if (title && link) {
                                items.push({ title, url: link.startsWith('http') ? link : 'https://news.google.com' + link });
                            }
                        });
                        break;
                    }
                }
                return items.slice(0, 20);
            });
            await apify_1.Dataset.pushData({ source: input.source, count: articles.length, articles });
            apify_1.log.info(`Found ${articles.length} articles`);
        }
    });
    await crawler.run([{ url }]);
    await apify_1.Actor.exit();
}
main().catch(e => { console.error(e); process.exit(1); });
