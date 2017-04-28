const token = process.env.TOKEN;
const fs = require('fs');
const moment = require('moment');
const Bot = require('node-telegram-bot-api');

const UserService = require('./user');
const CodeService = require('./code');

const admins = [45417065];

let bot;
let users = [];
moment.locale('ru');

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
      return bot.sendMessage(user.id, "Ваш таймер обновлен " + user.title).then((message) => {
        let currentUser = users.find((usr) => usr.id === user.id);
        if (!currentUser) {
          users.push({
            id: user.id
          });
        } else {
          currentUser.timer_message_id = '';
        }
        res(moment.unix(user.finishTime).format('lll:s'));
      })
    }).catch(rej);
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
    return bot.sendMessage(chat.id, "Ваша игра уже идет").then(() => {
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
  if (!userObject.title){
    userObject.title = userObject.first_name;
  }
  userObject.codes = [];
  fs.writeFile('users/' + chat.id + '.json', JSON.stringify(userObject), (err) => {
    if (err) {
      return console.error(err);
    }
    return bot.sendMessage(chat.id, "Ваша игра началась " + userObject.title).then(() => {
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
      return bot.sendMessage(chat_id, "Было").then(() => {
        return false;
      });
    }
  }).catch(() => {
    return bot.sendMessage(chat_id, "Ваша игра еще не началась, отправьте /start").then(() => {
      return false;
    });
  });
};

bot.onText(/\/start/, function(msg) {
  return userInit(msg.chat);
});

bot.onText(/\/help/, function(msg) {
  if (admins.indexOf(msg.chat.id) < 0) {
    return bot.sendMessage(msg.chat.id,
      "/start_game Начало игры, выставляет финишное время на сейчас + 30 минут \n"
    );
  }
  return bot.sendMessage(msg.chat.id,
        "/code_list - Показывает список кодов с их стоимостью. \n" +
        "/create_code [code_name] [code_value] - Создает новый код [code_name] со стоимостью  [code_value].\n" +
        "/delete_code [code_name] - Удаляет код с именем [code_name].\n" +
        "/change_code [code_name] [code_value] - Устанавливает стоимость [code_value] для кода [code_name] (не влияет на уже введенные юзером коды).\n" +
        "/user_list - Показывает список пользователей, начавших игру, с финишным временем и активированными кодами. \n" +
        "/clean_code [user_id] [code_name] - Убирает отметку использования для кода [code_name] у юзера [user_id]. \n" +
        "/delete_user [user_id] - Удаляет всю информацию о пользователе.\n" +
        "/change_time [user_id] [time_count] - Меняет финишное время для пользователя [user_id] на [time_count] (может быть отрицательным). \n" +
        "/restart_game - Перезагрузка, нужна для старта новой игры, команда удаляет всех сохраненных пользователей. \n" +
        "[code_value] - измеряется в секундах; [code_name] - строка русский или английских букв и цифр, не может начинаться с /."
  );
});

bot.onText(/\/start_game/, function(msg) {
  return userInit(msg.chat);
});

bot.onText(/\/stop_digest/, () => { //admin func, no idea for why I need it
  if (admins.indexOf(msg.chat.id) < 0) {
    return bot.sendMessage(msg.chat.id, "Нет прав");
  }
  eventer.emit('game:stop');
});

bot.onText(/\/restart_game/, (msg) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return bot.sendMessage(msg.chat.id, "Нет прав");
  }
  users = [];
  return UserService.deleteAllUsers().then(() => {
    return bot.sendMessage(msg.chat.id, "Все пользователи удалены");
  });
});

bot.onText(/\/create_code (.+) (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return bot.sendMessage(msg.chat.id, "Нет прав");
  }
  const codeString = match[1];
  const codeValue = match[2] * 1;
  if (!codeString || !codeValue || !Number.isInteger(codeValue)){
    return bot.sendMessage(msg.chat.id, "Вы что-то забыли, должно быть: '/create_code [code_name] [code_value]'");
  }
  return CodeService.newCode(codeString, codeValue).then(() => {
    return bot.sendMessage(msg.chat.id, "Новый код " + codeString + " со стоимостью " + codeValue + " добавлен");
  }).catch((codeString) => {
    return bot.sendMessage(msg.chat.id, "Этот код уже в базе, чтобы изменить, отправьте /change_code [code_name] [code_value]" + codeString);
  })
});


bot.onText(/\/delete_code (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return bot.sendMessage(msg.chat.id, "Нет прав");
  }
  const codeString = match[1];
  if (!codeString){
    return bot.sendMessage(msg.chat.id, "Вы что-то забыли, должно быть: '/delete_code [code_name]'");
  }
  return CodeService.changeCode(codeString).then(() => {
    return bot.sendMessage(msg.chat.id, "Код " + codeString + " удален");
  }).catch((err) => {
    console.error(err);
    return bot.sendMessage(msg.chat.id, "Код не найден");
  })
});

bot.onText(/\/change_code (.+) (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return bot.sendMessage(msg.chat.id, "Нет прав");
  }
  const codeString = match[1];
  const codeValue = match[2] * 1;
  if (!codeString || !codeValue || !Number.isInteger(codeValue)){
    return bot.sendMessage(msg.chat.id, "Вы что-то забыли, должно быть: '/change_code [code_name] [code_value]'");
  }
  return CodeService.changeCode(codeString, codeValue).then(() => {
    return bot.sendMessage(msg.chat.id, "Код " + codeString + " изменен, теперь его стоимость " + codeValue);
  }).catch((err) => {
    console.error(err);
    return bot.sendMessage(msg.chat.id, "Код не найден");
  })
});

bot.onText(/\/user_list/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return bot.sendMessage(msg.chat.id, "Нет прав");
  }
  return bot.sendMessage(msg.chat.id, JSON.stringify(users));
});

bot.onText(/\/code_list/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return bot.sendMessage(msg.chat.id, "Нет прав");
  }
  return bot.sendMessage(msg.chat.id, JSON.stringify(CodeService.codeBase));
});

bot.onText(/\/clean_code (.+) (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return bot.sendMessage(msg.chat.id, "Нет прав");
  }
  const userId = match[1] * 1;
  const codeString = match[2];
  if (Number.isInteger(userId)) {
    return UserService.getUser(userId).then((user) => {
      return UserService.cleanCode(user, codeString);
    }).catch(() => {
      return bot.sendMessage(msg.chat.id, "Юзер не найден");
    });
  }
  return bot.sendMessage(msg.chat.id, "Что?");
});

bot.onText(/\/delete_user (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return bot.sendMessage(msg.chat.id, "Нет прав");
  }
  const userId = match[1] * 1;
  if (Number.isInteger(userId)) {
    return UserService.deleteUser(userId).then(() => {
      users.splice(users.indexOf(userId));
      return bot.sendMessage(msg.chat.id, "Юзер " + userId + " удален");
    }).catch(() => {
      return bot.sendMessage(msg.chat.id, "Юзер не найден");
    });
  }
  return bot.sendMessage(msg.chat.id, "Что?");
});

bot.onText(/\/change_time (.+) (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return bot.sendMessage(msg.chat.id, "Нет прав");
  }
  const userId = match[1] * 1;
  const timeCount = match[2] * 1;
  if (Number.isInteger(timeCount)) {
    return UserService.getUser(userId).then((user) => {
      return changeTimer(user, timeCount).then((timeEnd) => {
        return bot.sendMessage(msg.chat.id, "Время юзера " + user.title +" закончится " + timeEnd);
      });
    }).catch(() => {
      return bot.sendMessage(msg.chat.id, "Юзер не найден");
    });
  } else {
    return bot.sendMessage(msg.chat.id, "Что?");
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
