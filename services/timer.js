const moment = require('moment');
const eventer = require('./eventer');
const userService = require('./user');
moment.locale('ru');

class TimerService {
  constructor() {

  }
  getTimer(finishTime) {
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

  sendTimer(user) {
    return this.getTimer(user.finishTime).then((timer) => {
      eventer.emit('message:send', user.id, timer.h + ':' + timer.m + ':' + timer.s);
      return Promise.resolve();
    }).catch((err) => {
      console.error(err || 'something wrong with timer');
      return Promise.reject();
    })
  }

  changeTimer(user, count) {
    return new Promise((res, rej) => {
      user.finishTime = moment.unix(user.finishTime).add(count, 'seconds').unix();
      return userService.saveUser(user).then(() => {
        eventer.emit('message:send', user.id, "Ваш таймер обновлен " + user.title);
        this.sendTimer(user).then(() => {
          return res(moment.unix(user.finishTime).format('lll:s'));
        });
      }).catch(rej);
    });
  };
}
module.exports = new TimerService();