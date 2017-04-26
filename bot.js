const token = process.env.TOKEN || '334935256:AAHjOFyqCVLK5pdbZ98_TvZTepLg-jrt9NQ';
const fs = require('fs');
const EventEmitter = require('events');
const moment = require('moment');
const Bot = require('node-telegram-bot-api');

class MyEmitter extends EventEmitter {}
const eventer = new MyEmitter();

let bot;
let users = [];
let codeBase = JSON.parse(fs.readFileSync('codes.json', 'utf8')).base;

if (process.env.NODE_ENV === 'production') {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
  bot = new Bot(token, {polling: true});
}

console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

const getUser = (user_id) => {
  return new Promise((res, rej) => {
    if (fs.existsSync('users/' + user_id + '.json')) {
      return fs.readFile('users/' +  user_id + '.json', 'utf8', function (err, userString) {
        if (err) {
          console.error(err);
          rej(false);
        }
        return res(JSON.parse(userString));
      });
    }
    rej();
  });
};

const saveUser = (userObject) => {
  return new Promise((res, rej) => {
    fs.writeFile('users/' + userObject.id + '.json', JSON.stringify(userObject), (err) => {
      if (err) rej(err);
      res();
    });
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

const changeTimer = (user, count) => {
  return new Promise((res, rej) => {
    user.finishTime = moment.unix(user.finishTime).add(count, 'seconds').unix();
    saveUser(user).then(() => {
      bot.sendMessage(user.id, "Your timer updated " + user.first_name).then((message) => {
        let currentUser = users.find((usr) => usr.id === user.id);
        if (!currentUser){
          users.push({
            id : user.id
          });
        }else{
          currentUser.timer_message_id = '';
        }
        return res();
      })
    });
  });
};

const globalInterval = () => {
  let intervalId = setInterval(() => {
    if (!users.length){
      return false;
    }
    for (let user of users){
      if (user){
        return getUser(user.id).then((userObject) => {
          if (userObject.finishTime){
            getTimer(userObject.finishTime).then((timer) => {
              if (user.timer_message_id){
                bot.editMessageText(timer.h + ':' + timer.m + ':' + timer.s, {
                  'chat_id': user.id, 'message_id': user.timer_message_id
                })
              }else{
                bot.sendMessage(user.id, timer.h + ':' + timer.m + ':' + timer.s).then((sentMessage) => {
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
            console.error('something wrong with user');
          }
        }).catch(() => {
          return false;
        });
      }
    }
  }, 1000);
  
  eventer.on('game:stop', () => {
    clearInterval(intervalId);
  });
};

const userInit = (chat) => {
  if (fs.existsSync('users/' + chat.id + '.json')) { //if user exist
    return bot.sendMessage(chat.id, "Your game already started").then(() => {
      let currentUser = users.find((usr) => usr.id === chat.id);
      if (!currentUser){
        users.push({
          id : chat.id
        });
      }else{
        currentUser.timer_message_id = '';
      }
      return false;
    });
  }
  
  //if new user
  let userObject = chat;
  userObject.finishTime = moment().add(30, 'minutes').unix();
  userObject.codes = [];
  fs.writeFile('users/' + chat.id + '.json', JSON.stringify(userObject), (err) => {
    if (err) {
      return console.error(err);
    }
    bot.sendMessage(chat.id, "Your game just started " + userObject.first_name).then(() => {
      users.push({
        id : chat.id
      });
    })
  }); //create new user file with user data from Tg
  return false;
};

const codeCheck = (chat_id, code) => {
  getUser(chat_id).then((user) => {
    if (!user.codes.find((oldCode) => oldCode === code.id)){
      changeTimer(user.id, code.value).then(() => {
        user.codes.push(code.id);
        return true;
      });
    } else {
      return bot.sendMessage(chat_id, "Old code");
    }
  }).catch(() => {
    return bot.sendMessage(chat_id, "Your game was not started, send /start");
  });
};

bot.onText(/\/stop/, () => {
  eventer.emit('game:stop');
});

bot.onText(/\/start/, function (msg) {
  return userInit(msg.chat);
});

bot.onText(/\/add (.+)/, (msg, match) => {
  const resp = match[1] * 1;
  if(Number.isInteger(resp)){
    return getUser(msg.chat.id).then((user) => {
      return changeTimer(user, resp);
    });
  } else {
    return bot.sendMessage(msg.chat.id, "No idea what you're mean");
  }
});

bot.onText(/\/echo (.+)/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message
  
  const resp = match[1]; // the captured "whatever"
  
  // send back the matched "whatever" to the chat
  bot.sendMessage(msg.chat.id, resp);
});

bot.onText(/(.+)/, (msg, match) => {
  if (match[1][0] === '/'){
    return false;
  }
  let foundCode = codeBase.find((code) => code.string === match[1]);
  console.log(msg.chat.id, foundCode);
  if (foundCode){
    codeCheck(msg.chat.id, foundCode);
  }
  return false;
});

bot.on('polling_error', (error) => {
  console.error('polling_error ' + error.code);  // => 'EFATAL'
});

bot.on('webhook_error', (error) => {
  console.error('webhook_error ' + error.code);  // => 'EPARSE'
});

globalInterval();

module.exports = bot;
