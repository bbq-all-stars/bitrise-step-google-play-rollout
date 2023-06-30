const cmd = require('commander');
const puppeteer = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth');
const totp = require("totp-generator");
const fs = require("fs");

(async () => {
    puppeteer.use(pluginStealth());
    puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')())
    puppeteer.use(require('puppeteer-extra-plugin-user-preferences')({userPrefs: {
            webkit: {
                webprefs: {
                    default_font_size: 16
                }
            }
        }}))

    cmd.program
        .option('-i, --id <char>', 'Google Play developer account ID')
        .option('-a, --app <char>', 'App ID (number) of Google Play app ID')
        .option('-t, --track <char>', 'Track name of you want to deploy')
        .option('-e, --email <char>', 'Deploy user email of Google account')
        .option('-p, --password <char>', 'Deploy user password of Google account')
        .option('-w, --ignore-warn', 'Ignore warning')
        .option('-s, --screenshot-review', 'Take review screenshot')
        .option('-d, --screenshot-dir <char>', 'Screenshot dir')
        .option('-c, --screenshot-size <char>', 'Screenshot size (e.g. 1920x1080)', '1920x1080')
        .option('-S, --totp-secret <char>', 'Two step verification secret')
        .option('-T, --timeout <number>', 'Timeout of Puppeteer')
        .option('-D, --dry-run', 'Dry run');
    cmd.program.parse();

    const options = cmd.program.opts();
    const url = 'https://play.google.com/console/u/0/developers/' + options.id + '/app/' + options.app + '/tracks/' + options.track;

    const puppeteerOptions = {
        // NOTE: Can't log in to Google on headless mode.
        headless : false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ], // ref. https://github.com/puppeteer/puppeteer/issues/3698
    }
    const pageWidth = Number(options.screenshotSize.split('x')[0])
    const pageHeight = Number(options.screenshotSize.split('x')[1])

    const browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();
    const timeout = Number(options.timeout)
    if (timeout){
        page.setDefaultTimeout(timeout)
        page.setDefaultNavigationTimeout(timeout)
    }
    await page.setExtraHTTPHeaders({
        'accept-language': 'en-US,en;q=0.9,hy;q=0.8'
    });
    await page.setViewport({
        width: 1920,
        height: 1080,
    });
    await page.goto(url, { waitUntil: 'networkidle0' });

    const deployer = new Deployer(page, {
        ignoreWarn : options.ignoreWarn,
        screenshotReview: options.screenshotReview,
        screenshotDir: options.screenshotDir,
        totpSecret: options.totpSecret,
        dryRun : options.dryRun
    });
    await deployer.login(options.email, options.password);
    await deployer.rollout();

    await browser.close();
})();

class Deployer {
    constructor(page, options) {
        this.page = page
        this.options = options
    }

    // NOTE: Reference https://gist.github.com/Brandawg93/728a93e84ed7b66d8dd0af966cb20ecb#file-google_login-ts-L80
    async login(email, password){
        console.log("1 ========================================")
        {
            // ===========================================
            await Deployer.delay(30000);
            let filePath = this.options.screenshotDir + '/test.png'
            await this.page.screenshot({path: filePath});
            await bodyHandle.dispose();
            // ===========================================

            await this.page.waitForSelector('#identifierId');
            let badInput = true;

            while (badInput) {
                await this.page.type('#identifierId', email);
                await Deployer.delay(1000);
                await this.page.keyboard.press('Enter');
                await Deployer.delay(1000);
                badInput = await this.page.evaluate(() => document.querySelector('#identifierId[aria-invalid="true"]') !== null);
                if (badInput) {
                    console.error('Incorrect email or phone. Please try again.');
                    await this.page.click('#identifierId', {clickCount: 3});
                }
            }
        }

        console.log("2 ========================================")
        {
            await this.page.waitForSelector('#password');
            await Deployer.delay(1000);
            await this.page.type('input[type="password"]', password);
            await Deployer.delay(1000);
            await this.page.keyboard.press('Enter');
        }

        console.log("3 ========================================")
        if (this.options.totpSecret){
            await this.page.waitForSelector('#totpPin');
            await Deployer.delay(1000);
            const token = totp(this.options.totpSecret);
            await this.page.type('input[type="tel"]', token);
            await Deployer.delay(200);
            await this.page.keyboard.press('Enter');
        }

        await this.page.waitForNavigation({waitUntil: 'networkidle0'});
        await Deployer.delay(1000);
    }

    async rollout(){
        console.log("4 ========================================")
        {
            const selector = 'track-page track-page-header console-header material-button[debug-id="header-button"] > button[type="submit"]';
            await this.page.waitForFunction(function (selector) {
                const button = document.querySelectorAll(selector)[0];
                const buttonContent = button.querySelector('div.button-content').textContent;
                return buttonContent === 'Edit release';
            }, {}, selector);
            await Deployer.delay(1000);
            await this.page.click(selector);
            await this.page.waitForNavigation({waitUntil: 'networkidle0'});
            await Deployer.delay(1000);
        }

        console.log("5 ========================================")
        {
            const selector = 'app-releases-prepare-page form-bottom-bar material-button[debug-id="review-button"] > button[type="submit"]';
            await this.page.waitForFunction(function (selector) {
                const button = document.querySelectorAll(selector)[0];
                const buttonContent = button.querySelector('div.button-content').textContent;
                return buttonContent === 'Next';
            }, {}, selector);
            await Deployer.delay(1000);
            await this.page.click(selector);
            await this.page.waitForNavigation({waitUntil: 'networkidle0'});
            await Deployer.delay(1000);
        }

        console.log("6 ========================================")
        {
            console.log("6.1 ========================================")
            await Deployer.delay(1000);

            const error = await this._checkError()
            if (error) {
                throw new Error(error)
            }
            const warning = await this._checkWarning()
            if (warning) {
                if (!this.options.ignoreWarn) {
                    throw new Error(warning)
                }
                fs.writeFileSync("/tmp/export_GOOGLE_PLAY_WARNING_TEXT", warning);
            }

            console.log("6.2 ========================================")
            if (this.options.screenshotReview) {
                const filePath = await this._takeScreenshot()
                fs.writeFileSync("/tmp/export_GOOGLE_PLAY_SCREENSHOT_PATH", filePath);
            }

            console.log("6.3 ========================================")
            const selector = 'releases-review-page form-bottom-bar material-button[debug-id="main-button"] > button[type="submit"]';
            await this.page.waitForFunction(function (selector) {
                const button = document.querySelectorAll(selector)[0];
                const buttonContent = button.querySelector('div.button-content').textContent;
                return buttonContent.startsWith('Save and publish')
            }, {}, selector);
            await Deployer.delay(1000);
            await this.page.click(selector);
            await Deployer.delay(1000);

            console.log("6.4 ========================================")
            const rolloutButtonSelector = 'material-dialog footer button[debug-id="yes-button"]';
            await this.page.waitForFunction(function (selector) {
                const button = document.querySelectorAll(selector)[0];
                const buttonContent = button.querySelector('span.yes-button-label').textContent;
                return buttonContent === 'Save and publish'
            }, {}, rolloutButtonSelector);
            await Deployer.delay(1000);
            if (!this.options.dryRun) {
                console.log("6.5 ========================================")
                await this.page.click(rolloutButtonSelector);
                await this.page.waitForNavigation({waitUntil: 'networkidle0'});
            }
            console.log("6.6 ========================================")
            await Deployer.delay(1000);
        }
    }

    async _checkError() {
        return await this.page.evaluate(function () {
            const headerSelector = 'releases-review-page validation-expandable[debug-id="errors-expandable"] status-text strong';
            const header = document.querySelectorAll(headerSelector)
            if (!header.length) {
                return false
            }
            const headerContent = header[0].textContent;
            if (!/Errors?$/.test(headerContent)) {
                return false
            }
            const selector = 'releases-review-page validation-expandable[debug-id="errors-expandable"] status-text single-validation [debug-id="validation-description"]';
            const elements = document.querySelectorAll(selector)
            const texts = Array.from(elements).map(e => e.textContent)
            return headerContent + ":\n" + texts.join("\n\n")
        })
    }

    async _checkWarning(){
        return await this.page.evaluate(function () {
            const headerSelector = 'releases-review-page validation-expandable[debug-id="warnings-expandable"] status-text strong';
            const header = document.querySelectorAll(headerSelector)
            if (!header.length) {
                return false
            }
            const headerContent = header[0].textContent;
            if (!/Warnings?$/.test(headerContent)) {
                return false
            }
            const selector = 'releases-review-page validation-expandable[debug-id="warnings-expandable"] status-text single-validation [debug-id="validation-description"]';
            const elements = document.querySelectorAll(selector)
            const texts = Array.from(elements).map(e => e.textContent)
            return headerContent + ":\n" + texts.join("\n\n")
        })
    }

    async _takeScreenshot() {
        const expansionButtons = await this.page.$$('.expansion-button')
        for (const expansionButton of expansionButtons) {
            await expansionButton.click()
            await Deployer.delay(1000);
        }

        let filePath = ""
        const today = new Date();
        const y = today.getFullYear().toString();
        const m = (today.getMonth() + 1).toString().padStart(2, "0");
        const d = today.getDate().toString().padStart(2, "0");
        const H = today.getHours().toString().padStart(2, "0");
        const M = today.getMinutes().toString().padStart(2, "0");
        const S = today.getSeconds().toString().padStart(2, "0");
        filePath = y + m + d + H + M + S + '_review.png';
        if (this.options.screenshotDir) {
            filePath = this.options.screenshotDir + '/' + filePath
        }

        const bodyHandle = await this.page.$('body');
        const {width, height} = await bodyHandle.boundingBox();
        await this.page.screenshot({
            path: filePath,
            clip: {
                x: 0,
                y: 0,
                width,
                height
            },
        });

        await bodyHandle.dispose();
        return filePath
    }

    // NOTE: https://stackoverflow.com/a/46965281
    static async delay(time) {
        return new Promise(function (resolve) {
            setTimeout(resolve, time)
        });
    }
}
