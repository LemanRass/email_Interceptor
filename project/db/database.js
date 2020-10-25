const fs = require("fs");

const DATABASE_PATH = __dirname + "/messages.json";

let messages = [];

function init() {
    return new Promise((resolve, reject) => {
        if(fs.existsSync(DATABASE_PATH)) {
            let content = fs.readFileSync(DATABASE_PATH);
            messages = JSON.parse(content);
        } else {
            fs.writeFileSync(DATABASE_PATH, "[]");
            messages = [];
        }
    
        console.log(`[Database -> init] Initialized!`);
        resolve();
    });
}

function save() {
    return new Promise((resolve, reject) => {
        fs.writeFileSync(DATABASE_PATH, JSON.stringify(messages));
        resolve();
    });
}

function add(message) {
    messages.push(message);
    console.log(`[Database -> add] ${messages.join('\r\n')}`);
    return save();
}

function exists(id) {
    return messages.some(n => n.id === id);
}

function get(count) {
    return messages.slice(0, count);
}

module.exports = {
    init,
    add,
    exists,
    get
};