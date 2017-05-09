const token = "334935256:AAHjOFyqCVLK5pdbZ98_TvZTepLg-jrt9NQ";
const fs = require('fs');
const moment = require('moment');

const Bot = require('node-telegram-bot-api');

const userService = require('./services/user');
const codeService = require('./services/code');
const timerService = require('./services/timer');
const eventer = require('./services/eventer');

const admins = [45417065];

let bot;

moment.locale('ru');
if (process.env.NODE_ENV === 'production') {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
  bot = new Bot(token, {polling: true});
}

console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

eventer.on('message:send', (chatId, messageText) => {
  bot.sendMessage(chatId, messageText);
});

const useCode = (chat_id, code) => {
  return userService.getUser(chat_id).then((user) => {
    if (user.finishTime > moment().unix()) {
      if (!user.codes.find((oldCode) => oldCode === code.string)) {
        return timerService.changeTimer(user, code.value).then(() => {
          user.codes.push(code.string);
          return userService.saveUser(user).then(() => {
            return timerService.sendTimer(user);
          });
        });
      } else {
        eventer.emit('message:send', chat_id, "Было");
        return false;
      }
    }else{
      eventer.emit('message:send', chat_id, "Извините, ваше время уже истекло");
      return false;
    }
  }).catch(() => {
    eventer.emit('message:send', chat_id, "Ваша игра еще не началась, отправьте /start");
    return false;
  });
};

bot.onText(/\/help/, function(msg) {
  if (admins.indexOf(msg.chat.id) < 0) {
    return eventer.emit('message:send', msg.chat.id,
      "/start_game Начало игры, выставляет финишное время на сейчас + 30 минут \n" +
      "/time - Показывает оставшееся время, запускает игру, если она еще не запущена."
    );
  }
  return eventer.emit('message:send', msg.chat.id,
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
  return userService.userInit(msg.chat).then((user) => {
    return timerService.sendTimer(user);
  });
});

bot.onText(/\/time/, function(msg) {
  return userService.userInit(msg.chat).then((user) => {
    return timerService.sendTimer(user);
  });
});

bot.onText(/\/restart_game/, (msg) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return eventer.emit('message:send', msg.chat.id, "Нет прав");
  }
  return userService.deleteAllUsers().then(() => {
    return eventer.emit('message:send', msg.chat.id, "Все пользователи удалены");
  });
});

bot.onText(/\/create_code (.+) (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return eventer.emit('message:send', msg.chat.id, "Нет прав");
  }
  const codeString = match[1];
  const codeValue = match[2] * 1;
  if (!codeString || !codeValue || !Number.isInteger(codeValue)){
    return eventer.emit('message:send', msg.chat.id, "Вы что-то забыли, должно быть: '/create_code [code_name] [code_value]'");
  }
  return codeService.newCode(codeString, codeValue).then(() => {
    return eventer.emit('message:send', msg.chat.id, "Новый код " + codeString + " со стоимостью " + codeValue + " добавлен");
  }).catch((codeString) => {
    return eventer.emit('message:send', msg.chat.id, "Этот код уже в базе, чтобы изменить, отправьте /change_code [code_name] [code_value]" + codeString);
  })
});


bot.onText(/\/delete_code (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return eventer.emit('message:send', msg.chat.id, "Нет прав");
  }
  const codeString = match[1];
  if (!codeString){
    return eventer.emit('message:send', msg.chat.id, "Вы что-то забыли, должно быть: '/delete_code [code_name]'");
  }
  return codeService.changeCode(codeString).then(() => {
    return eventer.emit('message:send', msg.chat.id, "Код " + codeString + " удален");
  }).catch((err) => {
    console.error(err);
    return eventer.emit('message:send', msg.chat.id, "Код не найден");
  })
});

bot.onText(/\/change_code (.+) (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return eventer.emit('message:send', msg.chat.id, "Нет прав");
  }
  const codeString = match[1];
  const codeValue = match[2] * 1;
  if (!codeString || !codeValue || !Number.isInteger(codeValue)){
    return eventer.emit('message:send', msg.chat.id, "Вы что-то забыли, должно быть: '/change_code [code_name] [code_value]'");
  }
  return codeService.changeCode(codeString, codeValue).then(() => {
    return eventer.emit('message:send', msg.chat.id, "Код " + codeString + " изменен, теперь его стоимость " + codeValue);
  }).catch((err) => {
    console.error(err);
    return eventer.emit('message:send', msg.chat.id, "Код не найден");
  })
});

// bot.onText(/\/user_list/, (msg, match) => { //admin func
//   if (admins.indexOf(msg.chat.id) < 0) {
//     return bot.sendMessage(msg.chat.id, "Нет прав");
//   }
//   return bot.sendMessage(msg.chat.id, JSON.stringify(users));
// });

bot.onText(/\/code_list/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return eventer.emit('message:send', msg.chat.id, "Нет прав");
  }
  return eventer.emit('message:send', msg.chat.id, JSON.stringify(codeService.codeBase));
});

bot.onText(/\/clean_code (.+) (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return eventer.emit('message:send', msg.chat.id, "Нет прав");
  }
  const userId = match[1] * 1;
  const codeString = match[2];
  if (Number.isInteger(userId)) {
    return userService.getUser(userId).then((user) => {
      return userService.cleanCode(user, codeString);
    }).catch(() => {
      return eventer.emit('message:send', msg.chat.id, "Юзер не найден");
    });
  }
  return eventer.emit('message:send', msg.chat.id, "Что?");
});

bot.onText(/\/delete_user (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return eventer.emit('message:send', msg.chat.id, "Нет прав");
  }
  const userId = match[1] * 1;
  if (Number.isInteger(userId)) {
    return userService.deleteUser(userId).then(() => {
      return eventer.emit('message:send', msg.chat.id, "Юзер " + userId + " удален");
    }).catch(() => {
      return eventer.emit('message:send', msg.chat.id, "Юзер не найден");
    });
  }
  return eventer.emit('message:send', msg.chat.id, "Что?");
});

bot.onText(/\/change_time (.+) (.+)/, (msg, match) => { //admin func
  if (admins.indexOf(msg.chat.id) < 0) {
    return eventer.emit('message:send', msg.chat.id, "Нет прав");
  }
  const userId = match[1] * 1;
  const timeCount = match[2] * 1;
  if (Number.isInteger(timeCount)) {
    return userService.getUser(userId).then((user) => {
      return timerService.changeTimer(user, timeCount).then((timeEnd) => {
        return eventer.emit('message:send', msg.chat.id, "Время юзера " + user.title +" закончится " + timeEnd);
      });
    }).catch(() => {
      return eventer.emit('message:send', msg.chat.id, "Юзер не найден");
    });
  } else {
    return eventer.emit('message:send', msg.chat.id, "Что?");
  }
});

bot.onText(/\/echo (.+)/, (msg, match) => {
  const resp = match[1]; // the captured "whatever"
  eventer.emit('message:send', msg.chat.id, resp);
});

bot.onText(/(.+)/, (msg, match) => {
  console.log('outside');
  if (match[1][0] === '/') {
    return false;
  }
  let foundCode = codeService.codeBase.find((code) => code.string === match[1]);
  if (foundCode) {
    return useCode(msg.chat.id, foundCode);
  }else{
    eventer.emit('message:send', msg.chat.id, "Не понимаю о чем вы.");
  }
  return false;
});

bot.on('polling_error', (error) => {
  console.error('polling_error ' + error);  // => 'EFATAL'
});

bot.on('webhook_error', (error) => {
  console.error('webhook_error ' + error);  // => 'EPARSE'
});

module.exports = bot;
