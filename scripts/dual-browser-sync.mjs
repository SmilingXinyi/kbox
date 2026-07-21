/**
 * Dual-browser WebRTC vault sync smoke test.
 * Opens two isolated Chromium contexts (device A / device B),
 * pairs via PeerJS peer ID (manual join path), then runs both merge strategies.
 */
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.KBOX_URL ?? 'http://127.0.0.1:4173';
const ARTIFACT_DIR = '/opt/cursor/artifacts/dual-browser-sync';
const PIN = '1234';

async function shot(page, name) {
    await mkdir(ARTIFACT_DIR, {recursive: true});
    const file = path.join(ARTIFACT_DIR, `${name}.png`);
    await page.screenshot({path: file, fullPage: true});
    console.log(`screenshot: ${file}`);
    return file;
}

async function setupVault(page, ownerName) {
    await page.goto(BASE_URL, {waitUntil: 'networkidle'});
    await page.getByRole('heading', {name: 'Set up your vault'}).waitFor({timeout: 15000});

    await page.getByPlaceholder('e.g. cloud-master').fill(ownerName);
    const pinInputs = page.locator('input[type="password"]');
    await pinInputs.nth(0).fill(PIN);
    await pinInputs.nth(1).fill(PIN);

    // Disable biometrics to avoid WebAuthn / simulator in automation.
    const biometricToggle = page.locator('label').filter({has: page.locator('input[type="checkbox"]')}).last();
    const checked = await page.locator('input[type="checkbox"]').isChecked();
    if (checked) {
        await biometricToggle.click();
    }

    await page.getByRole('button', {name: 'Create secure vault'}).click();
    await page.getByText('Vault unlocked').waitFor({timeout: 20000});
}

async function addApiKey(page, label, secret) {
    await page.getByRole('button', {name: 'Add'}).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({timeout: 8000});
    await dialog.getByPlaceholder('e.g. AWS Production').fill(label);
    await dialog.getByPlaceholder('Secret value').fill(secret);
    await dialog.getByRole('button', {name: 'Save'}).click();
    await page.getByText(label).first().waitFor({timeout: 10000});
}

async function openSync(page) {
    await page.getByRole('button', {name: 'Device sync'}).click();
    await page.getByRole('heading', {name: 'Device sync'}).waitFor({timeout: 5000});
}

async function startHost(page) {
    await page.getByRole('button', {name: 'Enable sync service'}).click();
    await page.getByText('Waiting for the other device to scan').waitFor({timeout: 30000});
    const peerCode = page.locator('code').first();
    await peerCode.waitFor({timeout: 30000});
    const peerId = (await peerCode.textContent())?.trim();
    if (!peerId || peerId === '…') {
        throw new Error('Host peer ID not ready');
    }
    return peerId;
}

async function joinAsGuest(page, peerId) {
    await page.getByRole('button', {name: 'Scan to join'}).click();
    await page.getByPlaceholder('Peer ID from host QR').fill(peerId);
    await page.getByRole('button', {name: 'Connect'}).click();
}

async function waitConnected(page) {
    await page.getByText('Devices linked — ready to sync').waitFor({timeout: 45000});
}

async function runStrategy(page, buttonName) {
    page.once('dialog', async dialog => {
        await dialog.accept();
    });
    await page.getByRole('button', {name: buttonName}).click();
    await page.getByText('Sync complete').waitFor({timeout: 45000});
}

async function closeSync(page) {
    // Prefer the dialog X (aria-label="Close"), not the full-screen backdrop.
    const x = page.locator('[role="dialog"] button[aria-label="Close"]');
    if (await x.count()) {
        await x.first().click();
        await page.getByRole('heading', {name: 'Device sync'}).waitFor({state: 'hidden', timeout: 5000}).catch(() => {});
        return;
    }
    await page.keyboard.press('Escape');
}

async function main() {
    console.log(`BASE_URL=${BASE_URL}`);
    const browser = await chromium.launch({
        headless: true,
        args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
    });

    const host = await browser.newContext({
        viewport: {width: 1100, height: 800},
        permissions: ['camera']
    });
    const guest = await browser.newContext({
        viewport: {width: 1100, height: 800},
        permissions: ['camera']
    });

    const hostPage = await host.newPage();
    const guestPage = await guest.newPage();

    hostPage.on('console', msg => console.log(`[host] ${msg.type()}: ${msg.text()}`));
    guestPage.on('console', msg => console.log(`[guest] ${msg.type()}: ${msg.text()}`));
    hostPage.on('pageerror', err => console.error('[host pageerror]', err));
    guestPage.on('pageerror', err => console.error('[guest pageerror]', err));

    try {
        console.log('--- Setup host vault (A) ---');
        await setupVault(hostPage, 'device-a');
        await shot(hostPage, '01-host-setup');

        console.log('--- Setup guest vault (B) ---');
        await setupVault(guestPage, 'device-b');
        await shot(guestPage, '02-guest-setup');

        console.log('--- Add distinct keys ---');
        await addApiKey(hostPage, 'Host-Only-Key', 'sk-host-secret-aaa');
        await addApiKey(guestPage, 'Guest-Only-Key', 'sk-guest-secret-bbb');
        await shot(hostPage, '03-host-with-key');
        await shot(guestPage, '04-guest-with-key');

        console.log('--- Open sync on both ---');
        await openSync(hostPage);
        await openSync(guestPage);

        console.log('--- Host enable service ---');
        const peerId = await startHost(hostPage);
        console.log(`peerId=${peerId}`);
        await shot(hostPage, '05-host-qr-waiting');

        console.log('--- Guest connect via peer ID ---');
        await joinAsGuest(guestPage, peerId);
        await waitConnected(hostPage);
        await waitConnected(guestPage);
        await shot(hostPage, '06-host-connected');
        await shot(guestPage, '07-guest-connected');
        console.log('Connected on both sides');

        console.log('--- Strategy: A overwrites B ---');
        await runStrategy(hostPage, 'A overwrites B');
        await guestPage.getByText('Sync complete').waitFor({timeout: 45000});
        await shot(hostPage, '08-host-synced-a-over-b');
        await shot(guestPage, '09-guest-synced-a-over-b');

        await closeSync(hostPage);
        await closeSync(guestPage);

        // Guest vault should now show Host-Only-Key
        await guestPage.getByText('Host-Only-Key').waitFor({timeout: 10000});
        const guestStillHasOwn = await guestPage.getByText('Guest-Only-Key').count();
        if (guestStillHasOwn > 0) {
            throw new Error('A-overwrites-B failed: guest still shows Guest-Only-Key');
        }
        console.log('Verified: guest now has Host-Only-Key only');

        // Re-pair and test B overwrites A: guest currently has host data.
        // Put a new key on guest, then pull to host.
        console.log('--- Prepare for B overwrites A ---');
        await addApiKey(guestPage, 'Guest-After-Sync', 'sk-guest-after');
        await openSync(hostPage);
        await openSync(guestPage);
        const peerId2 = await startHost(hostPage);
        console.log(`peerId2=${peerId2}`);
        await joinAsGuest(guestPage, peerId2);
        await waitConnected(hostPage);
        await waitConnected(guestPage);

        console.log('--- Strategy: Read B, overwrite A ---');
        await runStrategy(hostPage, 'Read B, overwrite A');
        await guestPage.getByText('Sync complete').waitFor({timeout: 45000});
        await shot(hostPage, '10-host-synced-b-over-a');
        await shot(guestPage, '11-guest-synced-b-over-a');

        await closeSync(hostPage);
        await closeSync(guestPage);

        await hostPage.getByText('Guest-After-Sync').waitFor({timeout: 10000});
        console.log('Verified: host now has Guest-After-Sync');

        console.log('\nSUCCESS: dual-browser sync strategies both worked');
    } catch (err) {
        console.error('\nFAILED:', err);
        await shot(hostPage, 'error-host').catch(() => {});
        await shot(guestPage, 'error-guest').catch(() => {});
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

await main();
