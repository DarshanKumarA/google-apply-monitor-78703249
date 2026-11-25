// Input is limited to public job IDs and their private recommendation tiers.
// Only the encrypted envelope is placed in the Pages artifact.
import {createCipheriv, randomBytes} from 'node:crypto';
import fs from 'node:fs';

const keyPath = 'matchroom/.match-key';
if (!fs.existsSync(keyPath)) {
  fs.writeFileSync(keyPath, randomBytes(32).toString('base64url'), {flag:'wx', mode:0o600});
}
const key = Buffer.from(fs.readFileSync(keyPath, 'utf8').trim(), 'base64url');
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const input = fs.readFileSync(0);
const ciphertext = Buffer.concat([cipher.update(input), cipher.final(), cipher.getAuthTag()]);
fs.writeFileSync('public/matches.json', JSON.stringify({v:1, iv:iv.toString('base64'), data:ciphertext.toString('base64')}));
