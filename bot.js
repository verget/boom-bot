const token = process.env.TOKEN || '334935256:AAHjOFyqCVLK5pdbZ98_TvZTepLg-jrt9NQ';//process.env.TOKEN;

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

const getTimer = (finishTime) => {
  return new Promise((res, rej) => {
    const now = moment();
    let secondsAll = moment.unix(finishTime).diff(now, 'seconds');
    let hoursDif = Math.floor(secondsAll / 1200);
    let minutesDif = Math.floor((secondsAll - (hoursDif * 1200)) / 60);
    let secondsDif = secondsAll - (hoursDif * 1200) - (minutesDif * 60);

    if (hoursDif.toString().length < 2) hoursDif = '0' + hoursDif;
    if (minutesDif.toString().length < 2) minutesDif = '0' + minutesDif;
    if (secondsDif.toString().length < 2) secondsDif = '0' + secondsDif;
    res({
      h: hoursDif,
      m: minutesDif,
      s: secondsDif
    });
  });
};

const showTimeDifference = (chat_id) => {
  return new Promise((res, rej) => {
    fs.readFile('users/' + chat_id + '.json', 'utf8', function (err, userData) {
      if (err) throw('unknown user');
      userData = JSON.parse(userData);
      getTimer(userData.finishTime).then((timer) => {
        console.log(timer);
        bot.sendMessage(chat_id, timer.h + ':' + timer.m + ':' + timer.s).then((sentMessage) => {
          setInterval(() => {
            getTimer(userData.finishTime).then((timer) => {
              bot.editMessageText(timer.h + ':' + timer.m + ':' + timer.s, {
                'chat_id': chat_id, 'message_id': sentMessage.message_id
              }).then((response) => {
                //here should be something
              })
            })
          }, 1000);
        })
      }).catch((err) => {
        rej(err);
      })
    })
  }).catch((err) => {
    console.error(err);
    return Promise.reject(err);
  })
};

bot.onText(/\/dif/, function (msg) {
  showTimeDifference(msg.chat.id);
});

bot.onText(/\/start/, function (msg) {
  if (fs.existsSync('users/' + msg.chat.id + '.json')) { //check for user exist
    bot.sendMessage(msg.chat.id, "Your game already started").then(() => {
      return false;
    });
  }
  let userObject = msg.from;
  userObject.finishTime = moment().add(30, 'minutes').unix();
  fs.writeFile('users/' + msg.chat.id + '.json', JSON.stringify(userObject), () => {
    bot.sendMessage(msg.chat.id, "Your game just started " + userObject.first_name).then((message) => {
      showTimeDifference(message.chat.id);
    })
  }); //create new user file with user data from Tg
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
  console.error('polling_error ' + error.code);  // => 'EFATAL'
});

bot.on('webhook_error', (error) => {
  console.error('webhook_error ' + error.code);  // => 'EPARSE'
});

module.exports = bot;
