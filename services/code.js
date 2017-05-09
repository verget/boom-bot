const fs = require('fs');

class codeService {

  getCode(codeString) {
    let codeObject = this.codeBase.find((cd) => cd.string === codeString);
    if (codeObject)
      return codeObject ? Promise.resolve(codeObject) : Promise.reject();
  }

  newCode(codeString, codeValue) {
    return this.getCode(codeString).then((codeObject) => {
      return Promise.reject('Already added');
    }).catch(() => {
      let codeBase = this.codeBase;
      codeBase.push({
        "string": codeString,
        "value": codeValue
      });
      this.codeBase = codeBase;
      return Promise.resolve({
        "string": codeString,
        "value": codeValue
      });
    })
  }

  changeCode(codeString, codeValue = null) {
    return new Promise((res, rej) => {
      this.getCode(codeString).then((found) => {
        let codeBase = this.codeBase;
        if (!codeValue) {
          codeBase.splice(codeBase.indexOf(found));
        } else {
          found.value = codeValue; //mutable?
        }
        this.codeBase = codeBase;
        return res();
      }).catch(() => {
        return rej("Code not found");
      })
    });
  }

  get codeBase() {
    return JSON.parse(fs.readFileSync('storage/codes.json', 'utf8'));
  }

  set codeBase(value) {
    fs.writeFile('storage/codes.json', JSON.stringify(value), (err) => {
      if (err) {
        console.error(err);
      }
    })
  }

}
module.exports = new codeService();
