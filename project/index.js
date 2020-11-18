const gmail = require('./gmail/gmail');
const database = require('./db/database');
const fs = require('fs');
const cors = require('cors');

//Web server
const express = require("express");
const app = express();
app.set('view engine', 'ejs');

var corsOptions = {
  origin: 'https://comaxinvest.com',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.get('/', function(req, res) {
    res.render("index.ejs", {});
});

app.get("/signals", cors(corsOptions), function(request, response){

    let count  = parseInt(request.query.count);

    if(Number.isInteger(count)) {
        response.json(database.get(count));
    } else {
        response.send("<b>count</b> is a required parameter.");
    }
});
app.listen(80);




//Constants
const EMAIL_LOCAL_ADDRESS = "me";
const EMAIL_SEARCH_TAGS = "from:noreply@siliconmarkets.ai";//"from:nsmakhnovetska@gmail.com";
const EMAIL_RESULTS_LIMIT = 10;

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

            //Mark as read
            //await gmail.makeReadMessage(EMAIL_LOCAL_ADDRESS, messages[i].id).catch(err => console.error(err));

            //Parse message object
            let parsedMessage = parseMessage(message);

            if(database.exists(parsedMessage.id)) {
                continue;
            }

            //Parse signal
            try {
                let signal = parseMessageBody(parsedMessage.body);
                delete parsedMessage.body;

                //console.log(signal, "\n\n\n");

                parsedMessage.signal = signal;

                //Add message to DB
                database.add(parsedMessage);
            } catch(err) {
                console.log(err);
            }
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
            result.unix = Math.round(new Date(result.timestamp).getTime()/1000);
            continue;
        }

        //Direction
        if(matches[i].indexOf("Direction") >= 0) {
            result.direction = matches[++i];
            continue;
        }

        if(matches[i].includes("Opening Price")) {
            result.openingPrice =  matches[++i];
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


        

        //Opening price
        //if(matches[i].indexOf("Opening Price") >= 0) {
        //    result.openingPrice = matches[++i];
        //    continue;
        //}

        //Profit/loss
        if(matches[i].indexOf("Profit/Loss") >= 0) {
            result.profitLoss = matches[++i];
            continue;
        }

        //Total strategy profit/loss
        if(matches[i].indexOf("Total Strategy P/L") >= 0) {
            result.totalStrategyPL = matches[++i];
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
