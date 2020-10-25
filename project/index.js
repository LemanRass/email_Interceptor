const gmail = require('./gmail/gmail');
const database = require('./db/database');
const fs = require('fs');

//Web server
const express = require("express");
const app = express();
// Set view engine to use
app.set('view engine', 'html');

app.get("/signals", function(request, response){

    let count  = parseInt(request.query.count);

    if(Number.isInteger(count)) {
        response.json(database.get(count));
    } else {
        response.send("<b>count</b> is a required parameter.");
    }
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




async function Update() {

    let request = await gmail.listMessages(EMAIL_LOCAL_ADDRESS, EMAIL_RESULTS_LIMIT, EMAIL_SEARCH_TAGS);
    let messages = request.data.messages;

    if(messages && messages.length > 0)
    {
        for(let i = 0; i < messages.length; i++) {

            //Get message object
            let message = await gmail.getMessage(EMAIL_LOCAL_ADDRESS, messages[i].id).catch(err => console.error(err));
            //Parse message object
            let parsedMessage = parseMessage(message);

            if(database.exists(parsedMessage.id)) {
                continue;
            }

            //Parse signal
            let signal = parseMessageBody(parsedMessage.body);
            parsedMessage.body = "";
            parsedMessage.signal = signal;

            //Add message to DB
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
    //let parts = json.data.payload.parts.filter(n => n.mimeType === "text/html");
    //let bodies = parts.map(n => fromBase64(n.body.data));
    //let body = bodies.join('');

    return {
        id,
        from,
        timestamp,
        subject,
        body
    };
}

function parseMessageBody(body) {
    
    let part = body.toString().match(/(<layout label=("|')Section 5("|')>)(\n|.+).(<\/layout>)/gs);
    let matches = part.toString().match(/(?<=<multiline>).+(?=<\/multiline>)/g);

    let result = {};

    for(let i = 0; i < matches.length; i++) {
        
        //Check if account
        if(matches[i].indexOf("Account") >= 0)
            continue;

        //Check if title
        if(matches[i].indexOf("Trade Confirmation") >= 0) {
            result.type = matches[i].split(" ")[0];
            continue;
        }

        //Check if strategy name
        if(matches[i].indexOf("Strategy Name") >= 0) {
            result.strategy = matches[++i];
            continue;
        }

        //Check if market
        if(matches[i].indexOf("Market") >= 0) {
            result.market = matches[++i];
            continue;
        }

        //Datetime
        if(matches[i].indexOf("Date/Time (UTC)") >= 0) {
            result.timestamp = matches[++i];
            continue;
        }

        //Direction
        if(matches[i].indexOf("Direction") >= 0) {
            result.direction = matches[++i];
            continue;
        }

        //Price
        if(matches[i].indexOf("Price") >= 0) {
            result.price = matches[++i];
            continue;
        }

        //Quantity
        if(matches[i].indexOf("Quantity") >= 0) {
            result.quantity = matches[++i];
            continue;
        }

        //STOP
        if(matches[i].indexOf("Type STOP") >= 0) {
            result.stop = {};
            i += 2;
            result.stop.level = matches[i];
            i += 2;
            result.stop.trailing = matches[i];
            continue;
        }

        //LIMIT
        if(matches[i].indexOf("Type LIMIT") >= 0) {
            result.limit = {};
            i += 2;
            result.limit.level = matches[i];
            continue;
        }
    }

    return result;
}
