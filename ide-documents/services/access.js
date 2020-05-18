var rs = require("http/v4/rs");
var repositoryContent = require("repository/v4/content");
var repositoryManager = require("repository/v4/manager");

rs.service()
    .resource("")
        .get(function (ctx, request, response) {
            let accessDefinitions = getAccessDefinitions();
            response.println(JSON.stringify(accessDefinitions));
        })
        .put(function(ctx, request, response) {
            let accessDefinitions = request.getJSON();
            updateAccessDefinitions(accessDefinitions);
            response.println(JSON.stringify(accessDefinitions));
        })
.execute();

function getAccessDefinitions() {
    return JSON.parse(repositoryContent.getText("ide-documents/security/roles.access"));
}

function updateAccessDefinitions(accessDefinitions) {
    var path = "/registry/public/ide-documents/security/roles.access";
    var content = JSON.stringify(accessDefinitions);
    repositoryManager.createResource(path, content)
}