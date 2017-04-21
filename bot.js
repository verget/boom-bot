const token = process.env.TOKEN;

const fs = require('fs');
const moment = require('moment');
const Bot = require('node-telegram-bot-api');
let bot;

if (process.env.NODE_ENV === 'production') {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
  bot = new Bot(token, {polling: true});
}

console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');


const showCurrentTimestamp = (chat_id) => {
  return bot.sendMessage(chat_id, moment().unix()).then(function(sentMessage) {
    setInterval(() => {
      bot.editMessageText(moment().unix(), {'chat_id' : chat_id, 'message_id' : sentMessage.message_id}).then((response) => {
      //here should be something
      });
    }, 1000);
  });
};

const showTimeDifference = (chat_id) => {
  let config;
  fs.readFile('config.json', 'utf8', function (err, data) {
    if (err) throw err;
    config = JSON.parse(data);
    const now = moment();
    
    let secondsAll = moment.unix(config.next_year).diff(now, 'seconds');
    let hoursDif = Math.floor(secondsAll / 1200);
    let minutesDif = Math.floor((secondsAll - (hoursDif * 1200)) / 60);
    let secondsDif = secondsAll - (hoursDif * 1200) - (minutesDif * 60);
    
    if (hoursDif.length < 2) hoursDif += '0' + hoursDif;
    if (minutesDif.length < 2) minutesDif += '0' + minutesDif;
    if (secondsDif.length < 2) secondsDif += '0' + secondsDif;
    console.log(hoursDif + ':' + minutesDif + ':' + secondsDif);
  });
  
  // return bot.sendMessage(chat_id, moment().unix()).then(function(sentMessage) {
  //   setInterval(() => {
  //     bot.editMessageText(moment().unix(), {'chat_id' : chat_id, 'message_id' : sentMessage.message_id}).then((response) => {
  //       //here should be something
  //     });
  //   }, 1000);
  // });
};

bot.onText(/\/time/, function(msg) {
  showCurrentTimestamp(msg.chat.id);
});

bot.onText(/\/current_dif/, function(msg) {
  showTimeDifference(msg.chat.id);
});

bot.onText(/\/echo (.+)/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const resp = match[1]; // the captured "whatever"
  
  // send back the matched "whatever" to the chat
  bot.sendMessage(msg.chat.id, resp);
});

bot.on('polling_error', (error) => {
  console.log(error.code);  // => 'EFATAL'
});

bot.on('webhook_error', (error) => {
  console.log(error.code);  // => 'EPARSE'
});

module.exports = bot;
