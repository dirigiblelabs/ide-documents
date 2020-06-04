/*
 * Copyright (c) 2010-2020 SAP and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *   SAP - initial API and implementation
 */
var rs = require("http/v4/rs");
var repositoryContent = require("repository/v4/content");
var repositoryManager = require("repository/v4/manager");
var documentsApi = require("ide-documents/api/lib/document");
var folderApi = require("ide-documents/api/lib/folder");
var cmisObjectApi = require("ide-documents/api/lib/object");
var bytes = require("io/v4/bytes");
var streams = require("io/v4/streams");

const INTERNAL_FOLDER = "__internal";
const INTERNAL_FOLDER_LOCATION = "/" + INTERNAL_FOLDER;
const ACCESS_CONSTRAINTS_FILE = "roles-access.json";
const ACCESS_CONSTRAINTS_FILE_LOCATION = "/" + INTERNAL_FOLDER + "/" + ACCESS_CONSTRAINTS_FILE;

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
    // let content = JSON.parse(repositoryContent.getText("ide-documents/security/roles.access"));
    return content;
}

function updateAccessDefinitions(accessDefinitions) {
    let path = "/registry/public/ide-documents/security/roles.access";
    let content = JSON.stringify(accessDefinitions);
    let resource = repositoryManager.getResource(path);
    if (resource.exists()) {    	
    	repositoryManager.deleteResource(path);
    }
    repositoryManager.createResource(path, content);
    updateAccessDefinitionsInCMS(content);
}

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