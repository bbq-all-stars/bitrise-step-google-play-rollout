const cmd = require('commander');
const puppeteer = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth');


(async () => {
    puppeteer.use(pluginStealth());

    cmd.program
        .option('-i, --id <char>', 'Google Play developer account ID')
        .option('-a, --app <char>', 'App ID (number) of Google Play app ID')
        .option('-t, --track <char>', 'Track name of you want to deploy')
        .option('-e, --email <char>', 'Deploy user email of Google account')
        .option('-p, --password <char>', 'Deploy user password of Google account')
        .option('-w, --ignore-warn', 'Ignore warning')
        .option('-s, --screenshot-review', 'Take review screenshot')
        .option('-d, --screenshot-dir', 'Screenshot dir')
        .option('-D, --debug', 'Debug mode');
    cmd.program.parse();

    const options = cmd.program.opts();
    const url = 'https://play.google.com/console/u/0/developers/' + options.id + '/app/' + options.app + '/tracks/' + options.track;

    const puppeteerOptions = {
        headless : true,
    }
    if (options.debug) {
        puppeteerOptions.headless = false;
    }

    const browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    const deployer = new Deployer(page, {
        ignoreWarn : options.ignoreWarn,
        screenshotReview: options.screenshotReview,
        screenshotDir: options.screenshotDir,
    });
    await deployer.login(options.email, options.password);
    const screenshotFilePath = await deployer.rollout();

    console.log(screenshotFilePath)

    await browser.close();
})();

class Deployer {
    constructor(page, options) {
        this.page = page
        this.options = options
    }

    // NOTE: Reference https://gist.github.com/Brandawg93/728a93e84ed7b66d8dd0af966cb20ecb#file-google_login-ts-L80
    async login(email, password){
        await (async () => {
            await this.page.waitForSelector('#identifierId');
            let badInput = true;

            while (badInput) {
                await this.page.type('#identifierId', email);
                await Deployer.delay(1000);
                await this.page.keyboard.press('Enter');
                await Deployer.delay(1000);
                badInput = await this.page.evaluate(() => document.querySelector('#identifierId[aria-invalid="true"]') !== null);
                if (badInput) {
                    console.log('Incorrect email or phone. Please try again.');
                    await this.page.click('#identifierId', {clickCount: 3});
                }
            }
        })();

        await (async () => {
            await this.page.waitForSelector('#password')
            await Deployer.delay(1000);
            await this.page.type('input[type="password"]', password);
            await Deployer.delay(1000);
            await this.page.keyboard.press('Enter');
            await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
            await Deployer.delay(1000);
        })();
    }

    async rollout(){
        await (async () => {
            const selector = 'track-page track-page-header console-header material-button[debug-id="header-button"] > button[type="submit"]';
            await this.page.waitForFunction(function (selector) {
                const button = document.querySelectorAll(selector)[0];
                const buttonContent = button.querySelector('div.button-content').textContent;
                return buttonContent === 'Edit release';
            }, {}, selector);
            await Deployer.delay(1000);
            await this.page.click(selector);
            await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
            await Deployer.delay(1000);
        })();

        await (async () => {
            const selector = 'app-releases-prepare-page form-bottom-bar material-button[debug-id="review-button"] > button[type="submit"]';
            await this.page.waitForFunction(function (selector) {
                const button = document.querySelectorAll(selector)[0];
                const buttonContent = button.querySelector('div.button-content').textContent;
                return buttonContent === 'Review release';
            }, {}, selector);
            await Deployer.delay(1000);
            await this.page.click(selector);
            await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
            await Deployer.delay(1000);
        })();

        const screenshotFilePath = await (async () => {
            await Deployer.delay(1000);

            const isError = await this.page.evaluate(function() {
                const errorSelector = 'releases-review-page validation-expandable[debug-id="errors-expandable"] status-text strong';
                const errorElement = document.querySelectorAll(errorSelector)
                if (!errorElement.length) {
                    return false
                }
                const errorContent = errorElement[0].textContent;
                return /Errors?$/.test(errorContent);
            })
            if (isError){
                throw new Error('error exists')
            }

            if (!this.options.ignoreWarn){
                const isWarning = await this.page.evaluate(function() {
                    const warningSelector = 'releases-review-page validation-expandable[debug-id="warnings-expandable"] status-text strong';
                    const warningElement = document.querySelectorAll(warningSelector)
                    if (!warningElement.length){
                        return false
                    }
                    const warningContent = warningElement[0].textContent;
                    return /Warnings?$/.test(warningContent);
                })
                if (isWarning){
                    throw new Error('warning exists')
                }
            }
            let filePath = ""
            if (this.options.screenshotReview){
                const expansionButtons = await this.page.$$('.expansion-button')
                for (const expansionButton of expansionButtons){
                    await expansionButton.click()
                    await Deployer.delay(1000);
                }

                const today = new Date();
                const y = today.getFullYear().toString();
                const m = (today.getMonth()+1).toString().padStart(2, "0");
                const d = today.getDate().toString().padStart(2, "0");
                const H = today.getHours().toString().padStart(2, "0");
                const M = today.getMinutes().toString().padStart(2, "0");
                const S = today.getSeconds().toString().padStart(2, "0");
                filePath = y+m+d+H+M+S+'_review.png';
                if (this.options.screenshotDir){
                    filePath = this.options.screenshotDir + '/' + filePath
                }
                await this.page.screenshot({
                    path: filePath,
                    fullPage: true,
                });
            }

            const selector = 'releases-review-page form-bottom-bar material-button[debug-id="rollout-button"] > button[type="submit"]';
            await this.page.waitForFunction(function (selector) {
                const button = document.querySelectorAll(selector)[0];
                const buttonContent = button.querySelector('div.button-content').textContent;
                return buttonContent.startsWith('Start roll-out to')
            }, {}, selector);
            await Deployer.delay(1000);
            await this.page.click(selector);
            await Deployer.delay(1000);

            const rolloutButtonSelector = 'material-dialog footer material-button[debug-id="yes-button"] > button[type="submit"]';
            await this.page.waitForFunction(function (selector) {
                const button = document.querySelectorAll(selector)[0];
                const buttonContent = button.querySelector('div.button-content').textContent;
                return buttonContent === 'Rollout'
            }, {}, rolloutButtonSelector);
            await Deployer.delay(1000);
            await this.page.click(rolloutButtonSelector);

            await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
            await Deployer.delay(1000);

            return filePath
        })();

        await (async () => {
            const selector = 'track-page track-page-header console-header material-button[debug-id="header-button"] > button[type="submit"]';
            await this.page.waitForFunction(function (selector) {
                const button = document.querySelectorAll(selector)[0];
                const buttonContent = button.querySelector('div.button-content').textContent;
                return buttonContent === 'Create new release';
            }, {}, selector);
        })();

        return screenshotFilePath
    }

    // NOTE: https://stackoverflow.com/a/46965281
    static async delay(time) {
        return new Promise(function (resolve) {
            setTimeout(resolve, time)
        });
    }
}
