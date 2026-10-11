import { app } from 'electron';
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Embedded cryptographic secret used for HMAC-SHA256 Node-Locked License verification
const LICENSE_HMAC_SECRET = 'GStock_PRO_2026_NodeLock_Secret_#98A7F4C2E1B093D5_DZ_POS';

// Cached in-memory state in the Main Process
let cachedMachineId: string | null = null;
let isActivatedMemoryCache: boolean = false;

/**
 * Queries Windows hardware identifiers (Motherboard UUID, CPU ID, Primary Disk Serial)
 * and hashes them with SHA-256 into a readable Machine ID (MACH-XXXX-XXXX-XXXX-XXXX).
 */
export function getMachineId(): string {
  if (cachedMachineId) {
    return cachedMachineId;
  }

  let rawHardwareFingerprint = '';

  try {
    const psCommand = [
      '$ErrorActionPreference = "SilentlyContinue"',
      '$u = (Get-CimInstance Win32_ComputerSystemProduct).UUID',
      '$c = (Get-CimInstance Win32_Processor | Select-Object -First 1).ProcessorId',
      '$d = (Get-CimInstance Win32_DiskDrive | Select-Object -First 1).SerialNumber',
      'Write-Output "$u|$c|$d"'
    ].join('; ');

    const stdout = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psCommand],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 8000,
      }
    );

    const cleaned = (stdout || '').trim().replace(/\s+/g, '');
    if (cleaned && cleaned !== '||') {
      rawHardwareFingerprint = cleaned;
    }
  } catch (err) {
    console.warn('Fallback hardware ID generation triggered:', err);
  }

  // Fallback if WMI/CIM service is restricted on the machine
  if (!rawHardwareFingerprint) {
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'GENERIC-CPU';
    const hostname = os.hostname() || 'WIN-POS';
    const arch = os.arch();
    const platform = os.platform();
    rawHardwareFingerprint = `FALLBACK|${hostname}|${cpuModel}|${arch}|${platform}`;
  }

  const hash = crypto
    .createHash('sha256')
    .update(`GESTIONSTOCK_HW_V1:${rawHardwareFingerprint}`)
    .digest('hex')
    .toUpperCase();

  cachedMachineId = `MACH-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
  return cachedMachineId;
}

/**
 * Generates the expected activation key for a specific Machine ID.
 */
export function computeExpectedLicenseKey(machineId: string): string {
  const normalizedId = machineId.trim().toUpperCase();
  const signature = crypto
    .createHmac('sha256', LICENSE_HMAC_SECRET)
    .update(`GESTIONSTOCK_LIC_V1:${normalizedId}`)
    .digest('hex')
    .toUpperCase();

  return `GSPRO-${signature.slice(0, 5)}-${signature.slice(5, 10)}-${signature.slice(10, 15)}-${signature.slice(15, 20)}-${signature.slice(20, 25)}`;
}

// Global activation password
const GLOBAL_ACTIVATION_PASSWORD = 'mokhtar24';

/**
 * Verifies a saved license token against the current Machine ID,
 * or checks if the candidate matches the global activation password.
 */
export function verifyLicenseKey(machineId: string, candidateKey: string): boolean {
  if (!candidateKey || typeof candidateKey !== 'string') {
    return false;
  }

  const trimmed = candidateKey.trim();

  // Check if it matches the global activation password (case-insensitive for convenience)
  if (trimmed.toLowerCase() === GLOBAL_ACTIVATION_PASSWORD.toLowerCase()) {
    return true;
  }

  const cleanCandidate = trimmed.toUpperCase();
  const expectedKey = computeExpectedLicenseKey(machineId);

  const candidateBuf = Buffer.from(cleanCandidate, 'utf8');
  const expectedBuf = Buffer.from(expectedKey, 'utf8');

  if (candidateBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

/**
 * Returns the path to `license.key` inside `app.getPath('userData')`.
 */
export function getLicenseFilePath(): string {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'license.key');
}

/**
 * Reads `license.key` on startup and verifies it against the local hardware fingerprint.
 */
export function checkLicenseOnStartup(): { activated: boolean; machineId: string } {
  const machineId = getMachineId();
  const licensePath = getLicenseFilePath();

  try {
    if (fs.existsSync(licensePath)) {
      const savedKey = fs.readFileSync(licensePath, 'utf8').trim();
      // Verify the saved token matches this specific machine's hardware ID
      const expectedMachineToken = computeExpectedLicenseKey(machineId);
      if (savedKey === expectedMachineToken) {
        isActivatedMemoryCache = true;
        return { activated: true, machineId };
      }
    }
  } catch (err) {
    console.error('Error reading license.key:', err);
  }

  isActivatedMemoryCache = false;
  return { activated: false, machineId };
}

/**
 * Validates the global activation password (`mokhtar24`) and persists a machine-bound
 * token to `userData/license.key` so the password is never exposed in plain text on disk.
 */
export function activateLicense(inputKey: string): {
  success: boolean;
  machineId: string;
  error?: string;
} {
  const machineId = getMachineId();
  const trimmedKey = (inputKey || '').trim();

  if (!trimmedKey) {
    return {
      success: false,
      machineId,
      error: "Veuillez saisir le mot de passe d'activation.",
    };
  }

  const isValid = verifyLicenseKey(machineId, trimmedKey);
  if (!isValid) {
    return {
      success: false,
      machineId,
      error: "Mot de passe d'activation incorrect.",
    };
  }

  try {
    const licensePath = getLicenseFilePath();
    // Save the hardware-bound token on disk so the password 'mokhtar24' is not stored in plain text
    const machineToken = computeExpectedLicenseKey(machineId);
    fs.writeFileSync(licensePath, machineToken, { encoding: 'utf8', mode: 0o600 });
    isActivatedMemoryCache = true;
    return {
      success: true,
      machineId,
    };
  } catch (err: any) {
    console.error('Failed to write license.key:', err);
    return {
      success: false,
      machineId,
      error: "Erreur lors de l'enregistrement de l'activation sur le disque.",
    };
  }
}

/**
 * Fast memory check used to guard IPC handlers.
 */
export function isLicenseActivated(): boolean {
  return isActivatedMemoryCache;
}

