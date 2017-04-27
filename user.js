const fs = require('fs');

module.exports = {
  
  getUser : (user_id) => {
    return new Promise((res, rej) => {
      if (fs.existsSync('users/' + user_id + '.json')) {
        return fs.readFile('users/' + user_id + '.json', 'utf8', function(err, userString) {
          if (err) {
            console.error(err);
            rej(false);
          }
          return res(JSON.parse(userString));
        });
      }
      rej();
    });
  },
  
  saveUser : (userObject) => {
    return new Promise((res, rej) => {
      fs.writeFile('users/' + userObject.id + '.json', JSON.stringify(userObject), (err) => {
        if (err) {
          return rej(err);
        }
        return res();
      });
    });
  },
  
  cleanCode : (userObject, codeString) => {
    let found = userObject.codes.indexOf(codeString);
    if (found > -1){
      userObject.codes.splice(found);
      return Promise.resolve();
    }else{
      return Promise.reject();
    }
  }
  
};