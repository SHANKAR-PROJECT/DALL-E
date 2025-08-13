import puppeteer from "puppeteer";
import express from "express";

const cookies = [
  { name: "_U", value: "lvcQNooxB5xj9ZcNNVmYDFmZeF69zhc1847LPkW_5KFgqduVuGy9iz20S4CXlmVMNxweceKjB3tcQaKCgAAIKbriQcQ", domain: ".bing.com" }
];

const app = express();
app.use(express.json());

class BingApi {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await this.browser.newPage();
    await page.setCookie(...cookies);
    console.log("Cookies set successfully");
  }

  async createImage(prompt) {
    const page = await this.browser.newPage();
    await page.goto(`https://www.bing.com/images/create?q=${encodeURIComponent(prompt)}`, {
      waitUntil: "networkidle2"
    });
    console.log(`Image generation requested for: ${prompt}`);
    // yahan tum apna scraping/download code laga sakte ho
  }
}

const bing = new BingApi();

app.get("/generate", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).send("Missing query");
  try {
    await bing.createImage(q);
    res.send(`Request sent to Bing for: ${q}`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

(async () => {
  await bing.initialize();
  app.listen(8080, () => console.log("Server running on port 8080"));
})();
