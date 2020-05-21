var rs = require("http/v4/rs");
var repositoryContent = require("repository/v4/content");
var repositoryManager = require("repository/v4/manager");

rs.service()
    .resource("")
        .get(function (ctx, request, response) {
            if (request.isUserInRole("Operator")) {
                let accessDefinitions = getAccessDefinitions();
                response.println(JSON.stringify(accessDefinitions));
            } else {
                response.setStatus(response.FORBIDDEN);
                response.println("Access forbidden");
            }
        })
        .put(function(ctx, request, response) {
            if (request.isUserInRole("Operator")) {
                let accessDefinitions = request.getJSON();
                updateAccessDefinitions(accessDefinitions);
                response.println(JSON.stringify(accessDefinitions));
            } else {
                response.setStatus(response.FORBIDDEN);
                response.println("Access forbidden");
            }
        })
.execute();

function getAccessDefinitions() {
    return JSON.parse(repositoryContent.getText("ide-documents/security/roles.access"));
}

function updateAccessDefinitions(accessDefinitions) {
    var path = "/registry/public/ide-documents/security/roles.access";
    var content = JSON.stringify(accessDefinitions);
    repositoryManager.deleteResource(path);
    repositoryManager.createResource(path, content);
}
