const fs = require('fs');
const moment = require('moment');

const eventer = require('./eventer');

class userService {

  userInit(chat) {
    return new Promise((res, rej) => {
      let userList = this.userList;
      this.getUser(chat.id).then((double) => { //if user exist
        return res(double);
      }).catch(() => { //if new user
        let userObject = chat;
        userObject.finishTime = moment().add(30, 'minutes').unix();
        if (!userObject.title) {
          userObject.title = userObject.first_name;
        }
        userObject.codes = [];
        userList.push(userObject);
        this.userList = userList; //for trigger setter

        eventer.emit('message:send', chat.id, "Ваша игра началась " + userObject.title);
        return res(userObject);
      })
    });
  };

  getUser(user_id) {
    return new Promise((res, rej) => {
      let userObject = this.userList.find((us) => us.id === user_id);
      if (userObject){
        return res(userObject);
      }else{
        return rej(false);
      }
    });
  }

  saveUser(userObject) {
    let userList = this.userList;
    userList.push(userObject);
    this.userList = userList;
    return Promise.resolve();
  }

  deleteUser(userId) {
    this.getUser(userId).then((foundUser) => {
      let userList = this.userList;
      userList.splice(userList.indexOf(foundUser));
      this.userList = userList;
      return Promise.resolve();
    }).catch(() => {
      return Promise.reject('User not found');
    })
  }

  deleteAllUsers() {
    this.userList = [];
    return Promise.resolve();
  }

  cleanCodeForUser(userObject, codeString) {
    let found = userObject.codes.indexOf(codeString);
    if (found > -1) {
      userObject.codes.splice(found);
      return this.saveUser(userObject);
    } else {
      return Promise.reject();
    }
  }

  get userList() {
    return JSON.parse(fs.readFileSync('storage/users.json', 'utf8'));
  }

  set userList(value) {
    fs.writeFile('storage/users.json', JSON.stringify(value), (err) => {
      if (err) {
        console.error(err);
      }
    })
  }
}

module.exports = new userService();