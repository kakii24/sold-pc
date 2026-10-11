#!/usr/bin/env node
/**
 * ============================================================================
 *  GESTIONSTOCK PRO — ADMIN LICENSE KEY GENERATOR (CONFIDENTIEL)
 * ============================================================================
 *  Ce script permet à l'administrateur de générer une Clé d'Activation unique
 *  liée à l'identifiant matériel (ID Machine) d'un poste client.
 *
 *  Utilisation :
 *    node scripts/generate-license.js MACH-XXXX-XXXX-XXXX-XXXX
 *
 *  Pour générer la clé du PC actuel :
 *    node scripts/generate-license.js --self
 * ============================================================================
 */

import crypto from 'crypto';
import { execFileSync } from 'child_process';
import os from 'os';

const LICENSE_HMAC_SECRET = 'GStock_PRO_2026_NodeLock_Secret_#98A7F4C2E1B093D5_DZ_POS';

function computeLicenseKey(machineId) {
  const normalizedId = machineId.trim().toUpperCase();
  const signature = crypto
    .createHmac('sha256', LICENSE_HMAC_SECRET)
    .update(`GESTIONSTOCK_LIC_V1:${normalizedId}`)
    .digest('hex')
    .toUpperCase();

  return `GSPRO-${signature.slice(0, 5)}-${signature.slice(5, 10)}-${signature.slice(10, 15)}-${signature.slice(15, 20)}-${signature.slice(20, 25)}`;
}

function getLocalMachineId() {
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
      { encoding: 'utf8', windowsHide: true, timeout: 8000 }
    );

    const cleaned = (stdout || '').trim().replace(/\s+/g, '');
    if (cleaned && cleaned !== '||') {
      rawHardwareFingerprint = cleaned;
    }
  } catch {
    // Fallback
  }

  if (!rawHardwareFingerprint) {
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'GENERIC-CPU';
    const hostname = os.hostname() || 'WIN-POS';
    rawHardwareFingerprint = `FALLBACK|${hostname}|${cpuModel}|${os.arch()}|${os.platform()}`;
  }

  const hash = crypto
    .createHash('sha256')
    .update(`GESTIONSTOCK_HW_V1:${rawHardwareFingerprint}`)
    .digest('hex')
    .toUpperCase();

  return `MACH-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
}

const arg = process.argv[2];

if (!arg) {
  const localId = getLocalMachineId();
  const localKey = computeLicenseKey(localId);
  console.log('\n==============================================================');
  console.log('  🔑 GENERATEUR DE LICENCE — GESTIONSTOCK PRO (ADMIN)');
  console.log('==============================================================');
  console.log('\nUsage pour un poste client :');
  console.log('  node scripts/generate-license.js <ID-MACHINE>');
  console.log('  Exemple : node scripts/generate-license.js MACH-4F9A-82C1-0E3B-77D4\n');
  console.log('--------------------------------------------------------------');
  console.log('Informations pour CE poste actuel (Local) :');
  console.log(`  ID Machine       : ${localId}`);
  console.log(`  Clé d'Activation : ${localKey}`);
  console.log('==============================================================\n');
  process.exit(0);
}

const targetMachineId = arg === '--self' ? getLocalMachineId() : arg.trim().toUpperCase();

if (!/^MACH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(targetMachineId)) {
  console.warn('\n⚠️  Attention : Le format standard attendu est MACH-XXXX-XXXX-XXXX-XXXX.');
}

const activationKey = computeLicenseKey(targetMachineId);

console.log('\n==============================================================');
console.log('  🔑 CLÉ D\'ACTIVATION GÉNÉRÉE — GESTIONSTOCK PRO');
console.log('==============================================================');
console.log(`  ID Machine Client : ${targetMachineId}`);
console.log(`  Clé d'Activation  : ${activationKey}`);
console.log('==============================================================\n');
