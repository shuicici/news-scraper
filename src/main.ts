import { Dataset, Actor, log } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

interface Input {
    source: 'google-news' | 'bbc' | 'reuters';
    query?: string;
}

async function main() {
    await Actor.init();
    const input = await Actor.getInput<Input>() as Input;
    if (!input?.source) throw new Error('Source required');
    
    const urls: Record<string, string> = {
        'google-news': 'https://news.google.com',
        'bbc': 'https://www.bbc.com/news',
        'reuters': 'https://www.reuters.com'
    };
    
    const url = input.query 
        ? `${urls[input.source]}/search?q=${encodeURIComponent(input.query)}`
        : urls[input.source];
    
    const crawler = new PlaywrightCrawler({
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 90,
        requestHandler: async ({ page }) => {
            await page.waitForTimeout(3000);
            
            const articles = await page.evaluate(() => {
                const items: any[] = [];
                const selectors = [
                    'article', '.article', '.news-item', 
                    'google-news .article', 'main article'
                ];
                
                for (const sel of selectors) {
                    const els = document.querySelectorAll(sel);
                    if (els.length > 0) {
                        els.forEach((el: any) => {
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
            
            await Dataset.pushData({ source: input.source, count: articles.length, articles });
            log.info(`Found ${articles.length} articles`);
        }
    });
    
    await crawler.run([{ url }]);
    await Actor.exit();
}
main().catch(e => { console.error(e); process.exit(1); });
