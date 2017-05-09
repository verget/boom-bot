const fs = require('fs');

class UserService {

  constructor() {

  }

  getUser(user_id) {
    return new Promise((res, rej) => {
      if (fs.existsSync('users/' + user_id + '.json')) {
        return fs.readFile('users/' + user_id + '.json', 'utf8', function (err, userString) {
          if (err) {
            console.error(err);
            rej(false);
          }
          if (userString){
            return res(JSON.parse(userString));
          }else{
            rej(false);
          }
        });
      }
      rej();
    });
  }

  saveUser(userObject) {
    return new Promise((res, rej) => {
      fs.writeFile('users/' + userObject.id + '.json', JSON.stringify(userObject), (err) => {
        if (err) {
          return rej(err);
        }
        return res();
      });
    });
  }

  deleteUser(userId) {
    return new Promise((res, rej) => {
      fs.unlink('users/' + userId + '.json', (err) => {
        if (err) {
          return rej(err);
        }
        return res();
      });
    });
  }

  deleteAllUsers() {
    return new Promise((res, rej) => {
      let path = 'users';
      if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
          let curPath = path + "/" + file;
          return res(fs.unlinkSync(curPath));
        });
      }
      return rej();
    });
  }

  cleanCode(userObject, codeString) {
    let found = userObject.codes.indexOf(codeString);
    if (found > -1) {
      userObject.codes.splice(found);
      return Promise.resolve();
    } else {
      return Promise.reject();
    }
  }

}

module.exports = new UserService();