const token = process.env.TOKEN;

const Bot = require('node-telegram-bot-api');
let bot;

if (process.env.NODE_ENV === 'production') {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
  bot = new Bot(token, {polling: true});
}

console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

bot.onText(/\/start/, function(msg) {
  bot.sendMessage(msg.chat.id, new Date()).then(function(sentMessage) {
    console.log(sentMessage);
  
    setInterval(() => {
      bot.editMessageText(new Date(), {'chat_id' : msg.chat.id, 'message_id' : sentMessage.message_id}).then((response) => {
        console.log(response);
      });
    }, 1000);
  });
  
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
