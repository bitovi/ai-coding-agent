If a TOKENS_PATH environment variable is set to a path (either relative or absolute) and a TOKENS_ENCRYPTION_KEY value.

then instead of saving the tokens in memory, the AuthManager will create
a EncryptedTokensFolderProvider(TOKENS_PATH, TOKENS_ENCRYPTION_KEY).


The provider will have the ability to `.get(service)` `.set(service, tokenObject)` tokens for services.

Those tokens should be encrypted on the filesystem.

Furthermore, we want to change the TOKENS_ENCRYPTION_KEY periodically.

The tokens should be encrypted such that if the TOKENS_ENCRYPTION_KEY changes, and the token is decrypted with a key that doesn't match the TOKENS_ENCRYPTION_KEY
the token was encrypted with, we will know. The `tokenObject`'s themselves 
are JavaScript objects. They will need to be serialized to JSON.  I suspect that decrypting with the wrong key will almost always result in an invalid JSON file. So `.get()` can just return null if the JSON doesn't .parse correctly.

Typescript helpers to encrypt and decrypt tokens should be put in `src/utils/`:

```js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function encrypt(data) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'base64'), iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  });
}

function decrypt(jsonStr) {
  const { iv, tag, data } = JSON.parse(jsonStr);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'base64'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  const decrypted = decipher.update(Buffer.from(data, 'hex'), 'binary', 'utf8') + decipher.final('utf8');
  return decrypted;
}

function saveTokens(tokenObj) {
  const data = encrypt(JSON.stringify(tokenObj));
  fs.writeFileSync(TOKEN_FILE, data, { mode: 0o600 });
}

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  const encrypted = fs.readFileSync(TOKEN_FILE, 'utf8');
  const decrypted = decrypt(encrypted);
  return JSON.parse(decrypted);
}
```