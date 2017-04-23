const token = process.env.TOKEN || '334935256:AAHjOFyqCVLK5pdbZ98_TvZTepLg-jrt9NQ';

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
    let hoursDif = Math.floor(secondsAll / 3600);
    let minutesDif = Math.floor((secondsAll - (hoursDif * 3600)) / 60);
    let secondsDif = secondsAll - (hoursDif * 3600) - (minutesDif * 60);

    if (hoursDif.toString().length < 2) hoursDif = '0' + hoursDif;
    if (minutesDif.toString().length < 2) minutesDif = '0' + minutesDif;
    if (secondsDif.toString().length < 2) secondsDif = '0' + secondsDif;
    res({h: hoursDif, m: minutesDif, s: secondsDif});
  });
};

const showTimeDifference = (chat_id) => {
  return new Promise((res, rej) => {
    fs.readFile('users/' + chat_id + '.json', 'utf8', function (err, userData) {
      if (err) rej('unknown user');
      userData = JSON.parse(userData);
      console.log(moment(userData.finishTime));
      getTimer(userData.finishTime).then((timer) => {
        console.log(timer);
        bot.sendMessage(chat_id, timer.h + ':' + timer.m + ':' + timer.s).then((sentMessage) => {
          setInterval(() => {
            getTimer(userData.finishTime).then((timer) => {
              bot.editMessageText(timer.h + ':' + timer.m + ':' + timer.s, {
                'chat_id': chat_id, 'message_id': sentMessage.message_id
              }).then((response) => {
                //here can be something
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
    bot.sendMessage(msg.chat.id, "Your game already started");
    return false;
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

bot.onText(/\/add (.+)/, (msg, match) => {
  const resp = match[1] *1;
  console.log(resp);
  if(Number.isInteger(resp)){
    console.log('is number');
    if (fs.existsSync('users/' + msg.chat.id + '.json')) {
      fs.readFile('users/' +  msg.chat.id + '.json', 'utf8', function (err, userString) {
        if (err){
          return false;
        }
        let userObject = JSON.parse(userString);
        console.log(moment(userObject.finishTime).add(resp, 'seconds').unix());
        userObject.finishTime = moment(userObject.finishTime).add(resp, 'seconds').unix(); //todo negative numbers?
        fs.writeFile('users/' + msg.chat.id + '.json', JSON.stringify(userObject), () => {
          bot.sendMessage(msg.chat.id, "Your timer updated " + userObject.first_name).then((message) => {
            showTimeDifference(message.chat.id);
          })
        });
      })
    }
  }
  bot.sendMessage(msg.chat.id, "No idea what you're mean");
  return false;
});

bot.on('polling_error', (error) => {
  console.error('polling_error ' + error.code);  // => 'EFATAL'
});

bot.on('webhook_error', (error) => {
  console.error('webhook_error ' + error.code);  // => 'EPARSE'
});

module.exports = bot;
