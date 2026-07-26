/**
 * Dual-browser WebRTC vault sync smoke test.
 * Opens two isolated Chromium contexts (device A / device B),
 * pairs via secure sync invite (manual join path), then runs both merge strategies.
 *
 * Timeouts are intentionally generous for PeerJS signaling / ICE on cold starts,
 * but every wait is tied to a concrete UI condition (no bare sleep).
 */
import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.KBOX_URL ?? 'http://127.0.0.1:4173';
/** Prefer Cursor CI artifacts dir; fall back to repo-local path for developer machines. */
const ARTIFACT_DIR =
    process.env.KBOX_SYNC_ARTIFACT_DIR ??
    (existsSync('/opt/cursor/artifacts')
        ? '/opt/cursor/artifacts/dual-browser-sync'
        : path.join(process.cwd(), 'artifacts', 'dual-browser-sync'));
const PIN = '123456';

/** Centralized waits — override via env for slower CI without editing the script. */
const TIMEOUT = {
    navigation: Number(process.env.KBOX_TIMEOUT_NAV ?? 15_000),
    vaultReady: Number(process.env.KBOX_TIMEOUT_VAULT ?? 20_000),
    dialog: Number(process.env.KBOX_TIMEOUT_DIALOG ?? 8_000),
    peerReady: Number(process.env.KBOX_TIMEOUT_PEER ?? 30_000),
    connected: Number(process.env.KBOX_TIMEOUT_CONNECTED ?? 45_000),
    synced: Number(process.env.KBOX_TIMEOUT_SYNCED ?? 45_000),
    assert: Number(process.env.KBOX_TIMEOUT_ASSERT ?? 10_000),
    close: Number(process.env.KBOX_TIMEOUT_CLOSE ?? 5_000)
};

async function shot(page, name) {
    await mkdir(ARTIFACT_DIR, {recursive: true});
    const file = path.join(ARTIFACT_DIR, `${name}.png`);
    await page.screenshot({path: file, fullPage: true});
    console.log(`screenshot: ${file}`);
    return file;
}

async function setupVault(page, ownerName) {
    await page.goto(BASE_URL, {waitUntil: 'networkidle', timeout: TIMEOUT.navigation});
    await page.getByRole('heading', {name: 'Set up your vault'}).waitFor({timeout: TIMEOUT.navigation});

    await page.getByPlaceholder('e.g. cloud-master').fill(ownerName);
    const pinInputs = page.locator('input[type="password"]');
    await pinInputs.nth(0).fill(PIN);
    await pinInputs.nth(1).fill(PIN);

    // Disable biometrics to avoid WebAuthn / simulator in automation.
    const biometricToggle = page
        .locator('label')
        .filter({has: page.locator('input[type="checkbox"]')})
        .last();
    const checked = await page.locator('input[type="checkbox"]').isChecked();
    if (checked) {
        await biometricToggle.click();
    }

    await page.getByRole('button', {name: 'Create secure vault'}).click();
    await page.getByText('Vault unlocked').waitFor({timeout: TIMEOUT.vaultReady});
}

async function addApiKey(page, label, secret) {
    await page.getByRole('button', {name: 'Add'}).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({timeout: TIMEOUT.dialog});
    await dialog.getByPlaceholder('e.g. AWS Production').fill(label);
    await dialog.getByPlaceholder('Secret value').fill(secret);
    await dialog.getByRole('button', {name: 'Save'}).click();
    await page.getByText(label).first().waitFor({timeout: TIMEOUT.assert});
}

async function openSync(page) {
    await page.getByRole('button', {name: 'Device sync'}).click();
    await page.getByRole('heading', {name: 'Device sync'}).waitFor({timeout: TIMEOUT.dialog});
}

async function startHost(page) {
    await page.getByRole('button', {name: 'Enable sync service'}).click();
    await page.getByText('Waiting for the other device to scan').waitFor({timeout: TIMEOUT.peerReady});
    const inviteCode = page.locator('code').first();
    // Full invite (peer ID + session key) is filled after PeerJS `open`.
    await inviteCode.waitFor({timeout: TIMEOUT.peerReady});
    await page.waitForFunction(
        el => {
            const text = (el.textContent ?? '').trim();
            return text.startsWith('kbox-sync:') && text.includes('"sk"');
        },
        await inviteCode.elementHandle(),
        {timeout: TIMEOUT.peerReady}
    );
    const invite = (await inviteCode.textContent())?.trim();
    if (!invite || !invite.startsWith('kbox-sync:')) {
        throw new Error('Host sync invite not ready');
    }
    return invite;
}

async function joinAsGuest(page, invite) {
    await page.getByRole('button', {name: 'Scan to join'}).click();
    await page.getByPlaceholder('kbox-sync:{…} invite from host').fill(invite);
    await page.getByRole('button', {name: 'Connect'}).click();
}

async function waitConnected(page) {
    await page.getByText('Devices linked — ready to sync').waitFor({timeout: TIMEOUT.connected});
}

async function runStrategy(hostPage, guestPage, buttonName, guestAcceptLabel) {
    hostPage.once('dialog', async dialog => {
        await dialog.accept();
    });
    await hostPage.getByRole('button', {name: buttonName}).click();
    // Guest must explicitly confirm before secrets are applied or sent.
    await guestPage.getByRole('button', {name: guestAcceptLabel}).waitFor({timeout: TIMEOUT.connected});
    await guestPage.getByRole('button', {name: guestAcceptLabel}).click();
    await hostPage.getByText('Sync complete').waitFor({timeout: TIMEOUT.synced});
    await guestPage.getByText('Sync complete').waitFor({timeout: TIMEOUT.synced});
}

async function closeSync(page) {
    // Prefer the dialog X (aria-label="Close"), not the full-screen backdrop.
    const x = page.locator('[role="dialog"] button[aria-label="Close"]');
    if (await x.count()) {
        await x.first().click();
        await page.getByRole('heading', {name: 'Device sync'}).waitFor({state: 'hidden', timeout: TIMEOUT.close});
        return;
    }
    await page.keyboard.press('Escape');
    await page.getByRole('heading', {name: 'Device sync'}).waitFor({state: 'hidden', timeout: TIMEOUT.close});
}

async function main() {
    console.log(`BASE_URL=${BASE_URL}`);
    console.log('TIMEOUTS', TIMEOUT);
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
        const invite = await startHost(hostPage);
        console.log(`inviteLen=${invite.length}`);
        await shot(hostPage, '05-host-qr-waiting');

        console.log('--- Guest connect via secure invite ---');
        await joinAsGuest(guestPage, invite);
        await waitConnected(hostPage);
        await waitConnected(guestPage);
        await shot(hostPage, '06-host-connected');
        await shot(guestPage, '07-guest-connected');
        console.log('Connected on both sides');

        console.log('--- Strategy: A overwrites B ---');
        await runStrategy(hostPage, guestPage, 'A overwrites B', 'Accept overwrite');
        await shot(hostPage, '08-host-synced-a-over-b');
        await shot(guestPage, '09-guest-synced-a-over-b');

        await closeSync(hostPage);
        await closeSync(guestPage);

        // Guest vault should now show Host-Only-Key
        await guestPage.getByText('Host-Only-Key').waitFor({timeout: TIMEOUT.assert});
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
        const invite2 = await startHost(hostPage);
        console.log(`invite2Len=${invite2.length}`);
        await joinAsGuest(guestPage, invite2);
        await waitConnected(hostPage);
        await waitConnected(guestPage);

        console.log('--- Strategy: Read B, overwrite A ---');
        await runStrategy(hostPage, guestPage, 'Read B, overwrite A', 'Send my vault');
        await shot(hostPage, '10-host-synced-b-over-a');
        await shot(guestPage, '11-guest-synced-b-over-a');

        await closeSync(hostPage);
        await closeSync(guestPage);

        await hostPage.getByText('Guest-After-Sync').waitFor({timeout: TIMEOUT.assert});
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
