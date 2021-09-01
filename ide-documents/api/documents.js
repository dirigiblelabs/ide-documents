let rs = require("http/v4/rs");
let user = require("security/v4/user");
let registry = require("platform/v4/registry");
let streams = require("io/v4/streams");
let upload = require('http/v4/upload');

let documentsProcessor = require("ide-documents/api/processors/documentsProcessor");

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

			let result = documentsProcessor.list(path);

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
			let overwrite = ctx.queryParameters.overwrite || false;
			let documents = upload.parseRequest();

			documentsProcessor.create(path, documents, overwrite);

			response.println(JSON.stringify(result));
		})
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
		.put(function(ctx, request, response) {
			let {path, name} = request.getJSON();
			if (!(path && name)){
				throw new Error("Request body must contain 'path' and 'name'");
			}

			documentsProcessor.rename(path, name);

			response.setStatus(response.OK);
			response.print(JSON.stringify(name));
		})
		.catch(function(ctx, error, request, response) {
			printError(response, response.BAD_REQUEST, 4, error.message);
		})
		.delete(function(ctx, request, response) {
			let forceDelete = ctx.queryParameters.force === "true" ? true : false;
			let objects = request.getJSON();

			documentsProcessor.delete(objects, forceDelete);

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