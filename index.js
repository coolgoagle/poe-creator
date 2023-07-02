const puppeteer = require('puppeteer-extra')
const { parse } = require('node-html-parser')
const crypto = require('crypto')
const fs = require('fs')

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
puppeteer.use(AdblockerPlugin({ blockTrackers: true }))

const getMail = async (email) => {
    const parts = email.split('@')
    return await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${parts[0]}&domain=${parts[1]}`).then(res => res.json())
}

const getMailSpecific = async (email, mailId) => {
    const parts = email.split('@')
    return await fetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${parts[0]}&domain=${parts[1]}&id=${mailId}`).then(res => res.json()).then(res => res.htmlBody)
}

const signup = async (browser, email) => {
    const page = await browser.newPage()
    // await page.setViewport({ width: 800, height: 600 })

    await page.goto('https://poe.com/login')

    await (await page.$('input[type="email"]')).type(email)
    await page.waitForSelector('button[class="Button_buttonBase__0QP_m Button_primary__pIDjn undefined"]:not([disabled])')
    await new Promise(res => setTimeout(res, 100))
    await (await page.$('button[class="Button_buttonBase__0QP_m Button_primary__pIDjn undefined"]:not([disabled])')).click()

    let code
    while (true) {
        await new Promise(res => setTimeout(res, 200))
        let mail = await getMail(email)
        if (mail.length < 1) continue

        let specificMail = await getMailSpecific(email, mail[0].id)
        let specificMailParsed = parse(specificMail)
        code = specificMailParsed.querySelector('div[style="font-family:system-ui, Segoe UI, sans-serif;font-size:19px;font-weight:700;line-height:1.6;text-align:center;color:#333333;"]').innerHTML
        break
    }

    // type in the verification code
    await page.waitForSelector('input[placeholder="Code"')
    await (await page.$('input[placeholder="Code"')).type(code)

    // click verify button
    await page.waitForSelector('button[class="Button_buttonBase__0QP_m Button_primary__pIDjn undefined"]:not([disabled])')
    await new Promise(res => setTimeout(res, 100))
    await (await page.$('button[class="Button_buttonBase__0QP_m Button_primary__pIDjn undefined"]:not([disabled])')).click()

    await page.waitForNavigation({ timeout: 10000 }).catch(async () => {
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
        await page.close()
        return null
    })
    if (page.$('div[class="InfoText_infoText__Coy92 InfoText_error__OQwmg"]')) {
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
        await page.close()
        return null
    }
    const cookies = await page.cookies()

    let poeToken
    for (const cookie of cookies) {
        if (cookie.name != "p-b") continue
        poeToken = cookie.value
    }
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    await page.close()
    return `${email}:${poeToken}`
}

const launch = async () => {
    const browser = await puppeteer.launch({ headless: "new" })
    while (true) {
        const email = crypto.randomBytes(12).toString('hex') + '@icznn.com'
        const account = await signup(browser, email).catch(err => null)
        if (account == null) continue
        fs.appendFileSync('accounts.txt', account + '\n')
        console.log(account)
    }
}
launch()