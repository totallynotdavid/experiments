const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Loads saved credentials if they exist.
 * @return {Promise<google.auth.JWT|null>} The loaded credentials as a Promise,
 * or null if they don't exist.
 * @throws {Error} If there is an error reading or parsing the credentials.
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Saves the client credentials to a file.
 * @param {google.auth.JWT} client The authenticated client.
 * @return {Promise<void>} A Promise that resolves when the credentials
 * are saved.
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Authorizes the application using saved credentials or by
 * authenticating the user.
 *
 * @return {Promise<google.auth.JWT>} A Promise that resolves
 * with the authorized client.
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Searches for files in a specific folder based on a query.
 * @param {google.auth.JWT} authClient The authorized client.
 * @param {string} folderId The ID of the folder to search in.
 * @param {string} query The search query.
 * @return {Promise<void>} A Promise that resolves when the search is complete.
 */
async function searchFilesInFolder(authClient, folderId, query) {
  const drive = google.drive({version: 'v3', auth: authClient});
  const res = await drive.files.list({
    pageSize: 5,
    q: `mimeType != 'application/vnd.google-apps.folder' and '${folderId}' ` +
   `in parents and fullText contains '${query}' and trashed = false`,
    fields: 'nextPageToken, files(id, name)',
  });
  const files = res.data.files;
  if (files.length === 0) {
    console.log('No files found.');
    return;
  }

  console.log('Files:');
  files.map((file) => {
    console.log(`${file.name} (${file.id})`);
  });
}

// Test Usage:
const folderId = '152My-loiJkz5eLNhHb8uZ164K62-8iQ-';
const query = 'townsend';
authorize()
    .then((authClient) => searchFilesInFolder(authClient, folderId, query))
    .catch(console.error);
