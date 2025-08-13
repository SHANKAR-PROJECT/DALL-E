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
      let executablePath = null;

      // Local me agar chromium hai to use karo
      try {
        const { stdout } = await promisify(exec)("which chromium");
        if (stdout.trim()) {
          executablePath = stdout.trim();
        }
      } catch {
        // Ignore - agar chromium nahi hai to puppeteer ka apna use hoga
      }

      this.browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: executablePath || undefined // Local me chromium, deploy me puppeteer ka apna
      });
    }
  }

  async setCookieAndReload(page) {
    const cookie = { name: "_U", value: this.options.cookie };
    await page.setCookie(cookie);
    await page.reload();
  }

  async createImage(query) {
    try {
      await this.initialize();
      if (!this.browser) throw new Error("Browser not launched");

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
      return { urls };
    } catch (error) {
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Yaha cookie directly add ki hai
const bing = new BingApi({
  cookie: "1Oa-lvcQNooxB5xj9ZcNNVmYDFmZeF69zhc1847LPkW_5KFgqduVuGy9iz20S4CXlmVMNxweceKjB3tcQaKCgAAIKbriQcQ-_T-LUehblRlGS6mQIqDcP6hrUkUIpxIuPYl_ZeJNsao7mK1X98u1hiabvknrXuk61qejw830bvl3BVNHx46Q4ijkRbLYOiHwxTG5XMSkWjC0Wd_9IE32w3GqPA4zZe5jCC5Gi475aztg",
  timeout: 60000
});

app.get("/g", async (req, res) => {
  const prompt = req.query.prompt;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt parameter" });
  }

  try {
    console.log(`Sending request to Bing for: ${prompt}`);
    const result = await bing.createImage(prompt);
    res.json({ urls: result.urls });
  } catch (error) {
    console.error("Error generating images:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
