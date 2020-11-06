const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = __dirname + '/token.json';
const CREDENTIALS_PATH = __dirname + "/credentials.json";

let gmail;

function init() {
  return new Promise((resolve, reject) => {
    fs.readFile(CREDENTIALS_PATH, async (err, content) => {
      if (err) {
        console.log('Error loading client secret file:', err);
        reject(err);
      } else {
        //Create auth
        const credentials = JSON.parse(content);
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

        //Handle token
        let token = await getToken(auth).catch(err => console.error(err));
        if (token === undefined) return;

        //Setup credentials
        auth.setCredentials(JSON.parse(token));

        //Init gmail
        gmail = google.gmail({ version: 'v1', auth });

        console.log("[Gmail -> init] Initialized!");
        resolve();
      }
    });
  });
}

//init();

function getToken(auth) {
  return new Promise((resolve, reject) => {

    if (fs.existsSync(TOKEN_PATH)) {

      fs.readFile(TOKEN_PATH, (err, token) => {

        if (err) {
          console.error(`[ReadFile] ${err}`);
          reject();
        }

        resolve(token);
      });
    } else {

      const authUrl = auth.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
      });

      console.log('Authorize this app by visiting this url:', authUrl);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('Enter the code from that page here: ', code => {
        rl.close();
        auth.getToken(code, (err, token) => {
          if (err) {
            console.error('Error retrieving access token', err);
            reject();
          }
          // Store the token to disk for later program executions
          fs.writeFile(TOKEN_PATH, JSON.stringify(token), err => {
            if (err) {
              console.error(err);
              reject();
            }

            console.log('Token stored to', TOKEN_PATH);
            resolve(token);
          });
        });
      });
    }
  });
}

/*
 * @userId: 'me',
 * @maxResults: 10,
 * @q: "from:nsmakhnovetska@gmail.com"
 */
function listMessages(userId, maxResults, q) {
  return new Promise((resolve, reject) => {
    gmail.users.messages.list({ userId, maxResults, q }, (err, res) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

/*
 * @userId: 'me'
 * @id: '1753a65f161f130d'
 */
function getMessage(userId, id) {
  return new Promise((resolve, reject) => {
    gmail.users.messages.get({ userId, id }, (err, res) => {
      if (err) {
        console.log('The API returned an error: ' + err);
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

module.exports = {
  init,
  listMessages,
  getMessage

  /*fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content), (g) => {
      gmail = g;
      listMessages('me', 10, "from:nsmakhnovetska@gmail.com");
    });
  });
  
  function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const auth = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);
  
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) {
        console.error(`[ReadFile] ${err}`);
        generateToken(auth);
      } else {
        auth.setCredentials(JSON.parse(token));
      }
  
      const gmail = google.gmail({version: 'v1', auth});
      callback(gmail);
    });
  }
  
  function generateToken(auth) {
    const authUrl = auth.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      auth.getToken(code, (err, token) => {
        if (err) return console.error('Error retrieving access token', err);
        auth.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log('Token stored to', TOKEN_PATH);
        });
      });
    });
  }
  
  /*function getThread(auth) {
    const gmail = google.gmail({ version: 'v1', auth });
    gmail.users.threads.get({
      userId: 'me',
      id: '1753a65f161f130d'
    }, (err, res) => {
      if (err) return console.log('The API returned an error: ' + err);
  
      var messages = res.data.messages;
      for(let i = 0; i < messages.length; i++) {
        var from = messages[i].payload.headers.find(n => n.name === "From").value;
        console.log(`From ${from}`);
  
        var subject = messages[i].payload.headers.find(n => n.name === "Subject").value;
        console.log(`Subject ${subject}`);
  
        var timestamp = messages[i].payload.headers.find(n => n.name === "Date").value;
        console.log(`Timestamp ${timestamp}`);
  
        var parts = messages[i].payload.parts.filter(n => n.mimeType === "text/plain");
        console.log(`Parts: ${parts.join('\n')}`);
  
        var bodies = parts.map(n => n.body.data);
        console.log(`Bodies: ${bodies.join('\n')}`);
  
        var body = bodies.join('\n');
        console.log(`Body: ${body}`);
      }
      //console.log(JSON.stringify(res, null, 2));
    });
  }*/

};