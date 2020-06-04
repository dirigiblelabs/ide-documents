var utils = require("ide-documents/security/utils");

let accessDefinitions = utils.getAccessDefinitions();
utils.updateAccessDefinitions(accessDefinitions);

console.log("Access Definitions successfully synchronized by [ide-documents-security] Job");