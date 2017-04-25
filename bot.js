const token = process.env.TOKEN || '334935256:AAHjOFyqCVLK5pdbZ98_TvZTepLg-jrt9NQ';
const fs = require('fs');
const EventEmitter = require('events');
const moment = require('moment');
const Bot = require('node-telegram-bot-api');

class MyEmitter extends EventEmitter {}
const eventer = new MyEmitter();

let bot;
let users = [];

if (process.env.NODE_ENV === 'production') {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
  bot = new Bot(token, {polling: true});
}

console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

const globalInterval = () => {
  let intervalId = setInterval(() => {
    if (!users.length){
      return false;
    }
    for (let user of users){
      fs.readFile('users/' + user.chat_id + '.json', 'utf8', function (err, userData) {
        let userObject = JSON.parse(userData);
        if (userObject.finishTime && !err){
          getTimer(userObject.finishTime).then((timer) => {
            if (user.timer_message_id){
              bot.editMessageText(timer.h + ':' + timer.m + ':' + timer.s, {
                'chat_id': user.chat_id, 'message_id': user.timer_message_id
              })
            }else{
              bot.sendMessage(user.chat_id, timer.h + ':' + timer.m + ':' + timer.s).then((sentMessage) => {
                user.timer_message_id = sentMessage.message_id;
              });
            }
            if (timer.zero){
              users.splice(users.indexOf(user));
            }
          }).catch((err) => {
            console.error(err || 'something wrong with timer');
          })
        }else{
          console.error(err || 'something wrong with user');
        }
      })
    }
  }, 1000);
  
  eventer.on('game:stop', () => {
    clearInterval(intervalId);
  });
  
};

const getTimer = (finishTime) => {
  return new Promise((res, rej) => {
    const now = moment();
    let secondsAll = moment.unix(finishTime).diff(now, 'seconds');
    if (secondsAll < 0){
      return res({h: '00', m: '00', s: '00', zero: true});
    }
    let hoursDif = Math.floor(secondsAll / 3600);
    let minutesDif = Math.floor((secondsAll - (hoursDif * 3600)) / 60);
    let secondsDif = secondsAll - (hoursDif * 3600) - (minutesDif * 60);

    if (hoursDif.toString().length < 2) hoursDif = '0' + hoursDif;
    if (minutesDif.toString().length < 2) minutesDif = '0' + minutesDif;
    if (secondsDif.toString().length < 2) secondsDif = '0' + secondsDif;
    return res({h: hoursDif, m: minutesDif, s: secondsDif, zero: false});
  });
};

const userInit = (chat) => {
  if (fs.existsSync('users/' + chat.id + '.json')) { //check for user exist
    bot.sendMessage(chat.id, "Your game already started").then(() => {
      if (!users.find((usr) => usr.chat_id === chat.id)){
        users.push({
          chat_id : chat.id
        });
      }
      return false;
    });
  }
  
  let userObject = chat.from;
  userObject.finishTime = moment().add(30, 'minutes').unix();
  fs.writeFile('users/' + chat.id + '.json', JSON.stringify(userObject), () => {
    bot.sendMessage(chat.id, "Your game just started " + userObject.first_name).then(() => {
      users.push({
        chat_id : chat.id
      });
    })
  }); //create new user file with user data from Tg
  return false;
};

bot.onText(/\/stop/, () => {
  eventer.emit('game:stop');
});

bot.onText(/\/start/, function (msg) {
  userInit(msg.chat);
});

bot.onText(/\/add (.+)/, (msg, match) => {
  const resp = match[1] * 1;
  if(Number.isInteger(resp)){
    if (fs.existsSync('users/' + msg.chat.id + '.json')) {
      return fs.readFile('users/' +  msg.chat.id + '.json', 'utf8', function (err, userString) {
        if (err){
          console.error(err);
          return false;
        }
        let userObject = JSON.parse(userString);
        userObject.finishTime = moment.unix(userObject.finishTime).add(resp, 'seconds').unix();
        fs.writeFile('users/' + msg.chat.id + '.json', JSON.stringify(userObject), () => {
          bot.sendMessage(msg.chat.id, "Your timer updated " + userObject.first_name).then((message) => {
            let currentUser = users.find((usr) => usr.chat_id === msg.chat.id);
            if (!currentUser){
              users.push({
                chat_id : msg.chat.id
              });
            }else{
              currentUser.timer_message_id = '';
            }
            return false;
          })
        });
      })
    }
  }
  return bot.sendMessage(msg.chat.id, "No idea what you're mean");
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

globalInterval();

module.exports = bot;
