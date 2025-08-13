import puppeteer from "puppeteer";
import { exec } from "child_process";
import { promisify } from "util";
import express from "express";

const app = express();
app.set("json spaces", 2);
const PORT = process.env.PORT || 8080;

class BingApi {
  constructor(options) {
    this.browser = null;
    this.options = options;
  }

  async initialize() {
    if (!this.browser) {
      let executablePath;
      try {
        // Local system par chromium ho to use karo
        const { stdout } = await promisify(exec)("which chromium");
        executablePath = stdout.trim() || puppeteer.executablePath();
      } catch (e) {
        // Deploy server par puppeteer ka inbuilt chromium path use karo
        executablePath = puppeteer.executablePath();
      }

      this.browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath
      });
    }
  }

  async setCookieAndReload(page) {
    const cookie = { name: "_U", value: this.options.cookie };
    await page.setCookie(cookie);
    await page.reload();
  }

  async createImage(query) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.initialize();

        if (!this.browser) {
          reject("Browser not launched");
          return;
        }

        const page = await this.browser.newPage();
        await page.goto(`https://www.bing.com/images/create`, {
          waitUntil: "networkidle2"
        });
        await this.setCookieAndReload(page);

        try {
          await page.waitForSelector("#bnp_btn_accept", { timeout: 5000 });
          await page.click("#bnp_btn_accept");
        } catch {
          console.log("Accept button not found, continuing...");
        }

        await page.focus("#sb_form_q");
        await page.keyboard.type(query);
        await page.keyboard.press("Enter");

        await page.waitForSelector(".imgpt", {
          timeout: this.options.timeout || 60_000
        });

        const res = await page.$$eval(".imgpt", (imgs) =>
          imgs.map((img) => img.querySelector("img")?.getAttribute("src"))
        );

        const urls = res.map((url) => url?.split("?")[0]);
        await page.close();
        resolve({ urls });
      } catch (error) {
        reject(error);
      }
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

const bing = new BingApi({
  cookie:
    "1Oa-lvcQNooxB5xj9ZcNNVmYDFmZeF69zhc1847LPkW_5KFgqduVuGy9iz20S4CXlmVMNxweceKjB3tcQaKCgAAIKbriQcQ-_T-LUehblRlGS6mQIqDcP6hrUkUIpxIuPYl_ZeJNsao7mK1X98u1hiabvknrXuk61qejw830bvl3BVNHx46Q4ijkRbLYOiHwxTG5XMSkWjC0Wd_9IE32w3GqPA4zZe5jCC5Gi475aztg"
});

app.get("/g", async (req, res) => {
  const prompt = req.query.prompt;

  try {
    console.log(`sending a request to bing`);
    const result = await bing.createImage(prompt);
    console.log(result.urls);
    res.json({ urls: result.urls });
  } catch (error) {
    console.error("Error generating images:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
