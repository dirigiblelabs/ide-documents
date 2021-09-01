let rs = require("http/v4/rs");
let user = require("security/v4/user");
let registry = require("platform/v4/registry");
let streams = require("io/v4/streams");
let upload = require('http/v4/upload');

let zipUtils = require("ide-documents/utils/cmis/zip");
let folderUtils = require("ide-documents/utils/cmis/folder");
let documentUtils = require("ide-documents/utils/cmis/document");
let objectUtils = require("ide-documents/utils/cmis/object");
let imageUtils = require("ide-documents/utils/cmis/image");

let contentTypeHandler = require("ide-documents/utils/content-type-handler");
let {replaceAll, unescapePath, getNameFromPath} = require("ide-documents/utils/string");

rs.service()
    .resource("")
        .get(function(ctx, request, response) {
            let path = unescapePath(ctx.queryParameters.path || "/");
            let folder = folderUtils.getFolderOrRoot(path);
            let result = folderUtils.readFolder(folder);
            filterByAccessDefinitions(result);
            response.println(JSON.stringify(result));
        })
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
		.post(function(ctx, request, response) {
			if (!upload.isMultipartContent()) {
				throw new Error("The request's content must be 'multipart'");
			}
			let path = unescapePath(ctx.queryParameters.path || "/");
			let documents = upload.parseRequest();
			let result = [];
			let overwrite = ctx.queryParameters.overwrite || false;
			for (let i = 0 ; i < documents.size(); i ++) {
				let folder = folderUtils.getFolder(path);
				if (overwrite){
					result.push(documentUtils.uploadDocumentOverwrite(folder, documents.get(i)));
				} else {
					result.push(documentUtils.uploadDocument(folder, documents.get(i)));		
				}
			}
			response.println(JSON.stringify(result));
		})
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
		.put(function(ctx, request, response) {
			let body = request.getJSON();
			if (!(body.path && body.name)){
				throw new Error("Request body must contain 'path' and 'name'");
			}
			let object = objectUtils.getObject(body.path);
			objectUtils.renameObject(object, body.name);
			response.setStatus(response.OK);
			response.print(JSON.stringify(body.name));
		})
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
		.delete(function(ctx, request, response) {
			let forceDelete = ctx.queryParameters.force;
			let objects = request.getJSON();
			for (let i in objects) {
				let object = objectUtils.getObject(objects[i]);
				let isFolder = object.getType().getId() === 'cmis:folder';
				if (isFolder && forceDelete === 'true') {
					folderUtils.deleteTree(object);
				} else {
					objectUtils.deleteObject(object);
				}
			}
			response.setStatus(response.NO_CONTENT);
		})
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
	.resource("folder")
		.post(function(ctx, request, response) {
			let body = request.getJSON();
			if (!(body.parentFolder && body.name)){
				throw new Error("Request body must contain 'parentFolder' and 'name'");
			}
			let folder = folderUtils.getFolderOrRoot(body.parentFolder);
			let result = folderUtils.createFolder(folder, body.name);
			response.setStatus(response.CREATED);
			response.print(JSON.stringify(result));
		})
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
	.resource("zip")
		.get(function(ctx, request, response) {;
			if (!ctx.queryParameters.path){
				throw new Error("Query parameter 'path' must be provided.");
			}
            let path = unescapePath(ctx.queryParameters.path);
			let name = getNameFromPath(path);
			let outputStream = response.getOutputStream();
			response.setContentType("application/zip");
			response.addHeader("Content-Disposition", "attachment;filename=\"" + name +".zip\"");
			zipUtils.makeZip(path, outputStream);
		})
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
		.post(function(ctx, request, response) {
			if (!upload.isMultipartContent()) {
				throw new Error("The request's content must be 'multipart'");
			}
			let path = unescapePath(ctx.queryParameters.path || "/");
			let documents = upload.parseRequest();
			let result = [];
			for (let i = 0; i < documents.size(); i ++){
				result.push(zipUtils.unpackZip(path, documents.get(i)));
			}
			response.println(JSON.stringify(result));
		})
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
	.resource("image")
		.post(function(ctx, request, response) {
			if (!upload.isMultipartContent()) {
				throw new Error("The request's content must be 'multipart'");
			}
			let path = unescapePath(ctx.queryParameters.path || "/");
			let documents = upload.parseRequest();
			let result = [];
			let width = ctx.queryParameters.width;
			let height = ctx.queryParameters.height;

			for (let i = 0; i < documents.size(); i ++) {
				let folder = folderUtils.getFolder(path);
				let name = documents.get(i).getName();
				if (width && height && name){
					result.push(imageUtils.uploadImageWithResize(folder, name, documents.get(i), parseInt(width), parseInt(height)));
				} else {
					result.push(documentUtils.uploadDocument(folder, documents.get(i)));
				}
			}

			response.println(JSON.stringify(result));
		})
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
	.resource("preview")
		.get(function(ctx, request, response) {
			if (!ctx.queryParameters.path) {
				throw new Error("Query parameter 'path' must be provided.");
			}
			let path = unescapePath(ctx.queryParameters.path);
			let document = documentUtils.getDocument(path);
			let contentStream = documentUtils.getDocumentStream(document);
			let contentType = contentStream.getMimeType();

			response.setContentType(contentType);
			response.write(contentStream.getStream().readBytes());
		})
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
	.resource("download")
		.get(function(ctx, request, response) {
			if (!ctx.queryParameters.path) {
				throw new Error("Query parameter 'path' must be provided.");
			}
			let path = unescapePath(ctx.queryParameters.path);
			let document = documentUtils.getDocument(path);
			let nameAndStream = documentUtils.getDocNameAndStream(document);
			let name = nameAndStream[0];
			let contentStream = nameAndStream[1];
			let contentType = contentStream.getMimeType();

			contentType = contentTypeHandler.getContentTypeBeforeDownload(name, contentType);

			response.setContentType(contentType);
			response.addHeader("Content-Disposition", "attachment;filename=\"" + name + "\"");
			streams.copy(contentStream.getStream(), response.getOutputStream());
		})
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
.execute();

function printError(response, httpCode, errCode, errMessage) {
	var body = {
		err: {
			code: errCode,
			message: errMessage
		}
	};
    console.error(JSON.stringify(body));
    response.setStatus(httpCode);
    response.println(JSON.stringify(body));
}

function filterByAccessDefinitions(folder) {
	let accessDefinitions = JSON.parse(registry.getText("ide-documents/security/roles.access"));
	folder.children = folder.children.filter(e => {
		let path = replaceAll((folder.path + "/" + e.name), "//", "/");
		if (path.startsWith("/__internal")) {
			return false;
		}
		if (!path.startsWith("/")) {
			path = "/" + path;
		}
		if (path.endsWith("/")) {
			path = path.substr(0, path.length - 1);
		}
		return hasAccessPermissions(accessDefinitions.constraints, path);
	});
}

function hasAccessPermissions(constraints, path) {
	for (let i = 0; i < constraints.length; i ++) {
		let method = constraints[i].method;
		let constraintPath = constraints[i].path;
		constraintPath = replaceAll(constraintPath, "//", "/");
		if (!constraintPath.startsWith("/")) {
			constraintPath = "/" + constraintPath;
		}
		if (constraintPath.endsWith("/")) {
			constraintPath = constraintPath.substr(0, constraintPath.length - 1);
		}
		if (constraintPath.length === 0 || (path.length >= constraintPath.length && constraintPath.startsWith(path))) {
			if (method !== null && method !== undefined && (method.toUpperCase() === "READ" || method === "*")) {				
				let roles = constraints[i].roles;
				for (let j = 0; j < roles.length; j ++) {
					if (!user.isInRole(roles[j])) {
						return false;
					}
				}
			}
		}
	}
	return true;
}