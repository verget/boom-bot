const fs = require('fs');

class CodeService {
  constructor() {
    this.codeBase = JSON.parse(fs.readFileSync('codes.json', 'utf8'));
  }
  
  saveCodes() {
    return new Promise((res, rej) => {
      return fs.writeFile('codes.json', JSON.stringify(this.codeBase), (err) => {
        if (err) {
          return rej(err);
        }
        return res();
      });
    })
  }
  
  newCode(codeString, codeValue) {
    let double = this.codeBase.find((cd) => cd.string === codeString);
    if (double) {
      return Promise.reject(codeString);
    }
    this.codeBase.push({
      "string": codeString,
      "value": codeValue
    });
    return this.saveCodes();
  }
  
  
  changeCode(codeString, codeValue = null) {
    return new Promise((res, rej) => {
      let found = this.codeBase.find((cd) => cd.string === codeString);
      if (!found) {
        return rej("Code not found");
      }
      if (!codeValue) {
        this.codeBase.splice(this.codeBase.indexOf(found));
      } else {
        found.value = codeValue;
      }
      return this.saveCodes().then(res).catch(rej);
    });
  }
}
module.exports = CodeService;
