const gmail = require('./gmail/gmail');
const database = require('./db/database');

//Web server
const express = require("express");
const app = express();
// Set view engine to use
app.set('view engine', 'html');

app.get("/signals", function(request, response){
    response.send(database.get(10).map(item => JSON.stringify(item, null, 2)).join("\n"));
});
app.listen(8000);




//Constants
const EMAIL_LOCAL_ADDRESS = "me";
const EMAIL_SEARCH_TAGS = "from:noreply@siliconmarkets.ai";//"from:nsmakhnovetska@gmail.com";
const EMAIL_RESULTS_LIMIT = 20;

const UPDATE_LOOP_DELAY_MS = 5000;






async function Start() {

    //Init database service
    await database.init();

    //Init gmail service
    await gmail.init();
    
    //Start loop
    Update();
}


function parseMessageHtml(html) {
    
    html = html.replace(/\n/g, '');
    html = html.replace(/\t/g, '');
    html = html.replace(/\r/g, '');

    //Slice section 5
    let startIndex = html.indexOf("<layout label='Section 5'>");
    let stopIndex = html.indexOf("<!-- END Section 5 -->");
    let section5Html = html.slice(startIndex, stopIndex);
    //console.log(section5Html);

    //Inner
    //startIndex = section5Html.indexOf("<!-- Three Columns -->");
    //stopIndex = section5Html.indexOf("<!-- END Three Columns -->");
    //section5Html = section5Html.slice(startIndex, stopIndex);

    //Slice section 2
    startIndex = html.indexOf("<layout label='Section 2'>");
    stopIndex = html.indexOf("<!-- END Section 2 -->");
    let section2Html = html.slice(startIndex, stopIndex);
    //console.log(section2Html.toString());

    return section5Html + section2Html;


    //Slice table
    //

    /*let matches = section5TableHtml.toString().match(/(?<=<multiline>).+(?=<\/multiline>)/g);
    console.log(matches.join('\r\n'));

    let obj = {
        'Strategy': matches[1],
        'Market': matches[3],
        'Timestamp': matches[5],
        'Direction': matches[7],
        'Price': matches[9],
        'Quantity': matches[11] 
    };

    console.log(obj);*/
}




async function Update() {

    let request = await gmail.listMessages(EMAIL_LOCAL_ADDRESS, EMAIL_RESULTS_LIMIT, EMAIL_SEARCH_TAGS);
    //console.log(JSON.stringify(request, null, 2));

    let messages = request.data.messages;

    if(messages && messages.length > 0)
    {
        for(let i = 0; i < messages.length; i++) {
            //Get message object
            let message = await gmail.getMessage(EMAIL_LOCAL_ADDRESS, messages[i].id).catch(err => console.error(err));
            //console.log(JSON.stringify(message, null, 2));

            //Parse message object
            let parsedMessage = parseMessage(message);

            if(database.exists(parsedMessage.id)) {
                continue;
            }

            //Do logic here with parsedMessage

            //console.log("");
            //console.log(parsedMessage);
            //console.log("");

            //let html = parseMessageHtml(parsedMessage.body);

            //if(html === "")
            //{
            //    console.error(`[HTML IS EMPTY]: ${parseMessage.id}`);
            //}

            //data.push(html);
            //fs.appendFileSync('test.html', html);

            //End of logic here...

            database.add(parsedMessage);
        }
    }

    //Invoke next step
    setTimeout(Update, UPDATE_LOOP_DELAY_MS);
}

Start();


function toBase64(str) {
    return Buffer.from(str).toString('base64');
}

function fromBase64(str) {
    return Buffer.from(str, 'base64').toString();
}

function parseMessage(json) {

    let id = json.data.id;
    let from = json.data.payload.headers.find(n => n.name === "From").value;
    let subject = json.data.payload.headers.find(n => n.name === "Subject").value;
    let timestamp = json.data.payload.headers.find(n => n.name === "Date").value;
    let body = fromBase64(json.data.payload.body.data);
    let html = parseMessageHtml(body);
    //let parts = json.data.payload.parts.filter(n => n.mimeType === "text/html");
    //let bodies = parts.map(n => fromBase64(n.body.data));
    //let body = bodies.join('');

    let signal = {};


    return {
        id,
        from,
        timestamp,
        subject,
      //  body, 
        html
    };
}