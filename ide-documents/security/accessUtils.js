var repositoryManager = require("repository/v4/manager");
var documentsApi = require("ide-documents/api/lib/document");
var folderApi = require("ide-documents/api/lib/folder");
var bytes = require("io/v4/bytes");
var streams = require("io/v4/streams");

const INTERNAL_FOLDER = "__internal";
const INTERNAL_FOLDER_LOCATION = "/" + INTERNAL_FOLDER;
const ACCESS_CONSTRAINTS_FILE = "roles-access.json";
const ACCESS_CONSTRAINTS_FILE_LOCATION = "/" + INTERNAL_FOLDER + "/" + ACCESS_CONSTRAINTS_FILE;

function updateAccessDefinitionsInCMS(data) {
    let folder = folderApi.getFolder(INTERNAL_FOLDER_LOCATION);
    if (!folder) {
        let rootFolder = folderApi.getFolderOrRoot("/");
        folderApi.createFolder(rootFolder, INTERNAL_FOLDER);
        folder = folderApi.getFolder(INTERNAL_FOLDER_LOCATION);
    }
    let document = {
        getName: function() {
            return ACCESS_CONSTRAINTS_FILE;
        },
        getContentType: function() {
            return "application/json";
        },
        getSize: function() {
            return data.length;
        },
        getInputStream: function() {
            let contentBytes = bytes.textToByteArray(data);
            return streams.createByteArrayInputStream(contentBytes);
        }
    }
    documentsApi.uploadDocument(folder, document);
}

exports.getAccessDefinitions = function () {
    let document = documentsApi.getDocument(ACCESS_CONSTRAINTS_FILE_LOCATION);
    let content = {
        constraints: []
    };

    try {
        let inputStream = documentsApi.getDocumentStream(document);
        let data = inputStream.getStream().readBytes();
        content = JSON.parse(bytes.byteArrayToText(data));
    } catch (e) {
        // Do nothing
    }
    return content;
};

exports.updateAccessDefinitions = function(accessDefinitions) {
    let path = "/registry/public/ide-documents/security/roles.access";
    let content = JSON.stringify(accessDefinitions);
    let resource = repositoryManager.getResource(path);
    if (resource.exists()) {    	
    	repositoryManager.deleteResource(path);
    }
    repositoryManager.createResource(path, content);
    updateAccessDefinitionsInCMS(content);
};