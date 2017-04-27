const token = process.env.TOKEN;
const fs = require('fs');
const EventEmitter = require('events');
const moment = require('moment');
const Bot = require('node-telegram-bot-api');

class MyEmitter extends EventEmitter {}
const eventer = new MyEmitter();

const UserService = require('./user');
const Code = require('./code');
const CodeService = new Code;

let bot;
let users = [];

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
    if (secondsAll < 0) {
      return res({h: '00', m: '00', s: '00', zero: true});
    }
    let hoursDif = Math.floor(secondsAll / 3600);
    let minutesDif = Math.floor((secondsAll - (hoursDif * 3600)) / 60);
    let secondsDif = secondsAll - (hoursDif * 3600) - (minutesDif * 60);
  
    if (hoursDif.toString().length < 2) {
      hoursDif = '0' + hoursDif;
    }
    if (minutesDif.toString().length < 2) {
      minutesDif = '0' + minutesDif;
    }
    if (secondsDif.toString().length < 2) {
      secondsDif = '0' + secondsDif;
    }
    return res({h: hoursDif, m: minutesDif, s: secondsDif, zero: false});
  });
};

const changeTimer = (user, count) => {
  return new Promise((res, rej) => {
    user.finishTime = moment.unix(user.finishTime).add(count, 'seconds').unix();
    return UserService.saveUser(user).then(() => {
      return bot.sendMessage(user.id, "Your timer updated " + user.first_name).then((message) => {
        let currentUser = users.find((usr) => usr.id === user.id);
        if (!currentUser) {
          users.push({
            id: user.id
          });
        } else {
          currentUser.timer_message_id = '';
        }
        res();
      })
    });
  });
};

const globalInterval = () => {
  let intervalId = setInterval(() => {
    if (!users.length) {
      return false;
    }
    for (let user of users) {
      if (user) {
        return UserService.getUser(user.id).then((userObject) => {
          if (userObject.finishTime) {
            return getTimer(userObject.finishTime).then((timer) => {
              if (user.timer_message_id) {
                bot.editMessageText(timer.h + ':' + timer.m + ':' + timer.s, {
                  'chat_id': user.id, 'message_id': user.timer_message_id
                }).then().catch((err) => {
                  console.error('edit message err');
                })
              } else {
                bot.sendMessage(user.id, timer.h + ':' + timer.m + ':' + timer.s)
                  .then((sentMessage) => {
                    user.timer_message_id = sentMessage.message_id;
                  });
              }
              if (timer.zero) {
                users.splice(users.indexOf(user));
                return false;
              }
            }).catch((err) => {
              console.error(err || 'something wrong with timer');
            })
          } else {
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
      if (!currentUser) {
        users.push({
          id: chat.id
        });
      } else {
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
        id: chat.id
      });
    })
  }); //create new user file with user data from Tg
  return false;
};

const useCode = (chat_id, code) => {
  return UserService.getUser(chat_id).then((user) => {
    if (!user.codes.find((oldCode) => oldCode === code.string)) {
      return changeTimer(user, code.value).then(() => {
        user.codes.push(code.string);
        return UserService.saveUser(user).then(() => {
          return true;
        });
      });
    } else {
      return bot.sendMessage(chat_id, "Old code").then(() => {
        return false;
      });
    }
  }).catch(() => {
    return bot.sendMessage(chat_id, "Your game was not started, send /start").then(() => {
      return false;
    });
  });
};

bot.onText(/\/start/, function(msg) {
  return userInit(msg.chat);
});

bot.onText(/\/stop/, () => { //admin func
  eventer.emit('game:stop');
});

bot.onText(/\/create_code (.+) (.+)/, (msg, match) => { //admin func
  const codeString = match[1];
  const codeValue = match[2] * 1;
  if (!codeString || !codeValue || !Number.isInteger(codeValue)){
    return bot.sendMessage(msg.chat.id, "You forgot something, should be '/new_code [code_name] [code_value]'");
  }
  return CodeService.newCode(codeString, codeValue).then(() => {
    return bot.sendMessage(msg.chat.id, "New code " + codeString + " with value " + codeValue + " added");
  }).catch((codeString) => {
    return bot.sendMessage(msg.chat.id, "This code already in base, for change it send /change_code " + codeString);
  })
});


bot.onText(/\/remove_code (.+)/, (msg, match) => { //admin func
  const codeString = match[1];
  if (!codeString){
    return bot.sendMessage(msg.chat.id, "You forgot something, should be '/remove_code [code_name]'");
  }
  return CodeService.changeCode(codeString).then(() => {
    return bot.sendMessage(msg.chat.id, "Code " + codeString + " removed");
  }).catch((err) => {
    console.error(err);
    return bot.sendMessage(msg.chat.id, "Code not found");
  })
});

bot.onText(/\/change_code (.+) (.+)/, (msg, match) => { //admin func
  const codeString = match[1];
  const codeValue = match[2] * 1;
  if (!codeString || !codeValue || !Number.isInteger(codeValue)){
    return bot.sendMessage(msg.chat.id, "You forgot something, should be '/change_code [code_name] [code_value]'");
  }
  return CodeService.changeCode(codeString, codeValue).then(() => {
    return bot.sendMessage(msg.chat.id, "Code " + codeString + " changed now its value is " + codeValue);
  }).catch((err) => {
    console.error(err);
    return bot.sendMessage(msg.chat.id, "Code not found");
  })
});

bot.onText(/\/user_list/, (msg, match) => { //admin func
  return bot.sendMessage(msg.chat.id, JSON.stringify(users));
});

bot.onText(/\/code_list/, (msg, match) => { //admin func
  return bot.sendMessage(msg.chat.id, JSON.stringify(CodeService.codeBase));
});

bot.onText(/\/clean_code (.+) (.+)/, (msg, match) => { //admin func
  const userId = match[1] * 1;
  const codeString = match[2];
  if (Number.isInteger(userId)) {
    return UserService.getUser(userId).then((user) => {
      return UserService.cleanCode(user, codeString);
    }).catch(() => {
      return bot.sendMessage(msg.chat.id, "User not found");
    });
  }
  return bot.sendMessage(msg.chat.id, "No idea what you're mean");
});

bot.onText(/\/change_time (.+) (.+)/, (msg, match) => { //admin func
  const userId = match[1] * 1;
  const timeCount = match[2] * 1;
  if (Number.isInteger(timeCount)) {
    return UserService.getUser(userId).then((user) => {
      return changeTimer(user, timeCount);
    }).catch(() => {
      return bot.sendMessage(msg.chat.id, "User not found");
    });
  } else {
    return bot.sendMessage(msg.chat.id, "No idea what you're mean");
  }
});

bot.onText(/\/echo (.+)/, (msg, match) => {
  const resp = match[1]; // the captured "whatever"
  bot.sendMessage(msg.chat.id, resp);
});

bot.onText(/(.+)/, (msg, match) => {
  console.log('outside');
  if (match[1][0] === '/') {
    return false;
  }
  let foundCode = CodeService.codeBase.find((code) => code.string === match[1]);
  if (foundCode) {
    useCode(msg.chat.id, foundCode);
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
